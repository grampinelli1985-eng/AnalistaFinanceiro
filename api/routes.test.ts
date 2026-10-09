// Testes das rotas com Supabase e Asaas simulados (nenhuma chamada real de rede).
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Supabase falso: guarda as operações feitas em cada tabela ──
type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const updates: { table: string; values: Row; filters: [string, unknown][] }[] = [];
const inserts: { table: string; rows: Row[] }[] = [];
let authUser: { id: string; email: string } | null = null;

function queryBuilder(table: string) {
  const filters: [string, unknown][] = [];
  let pendingUpdate: Row | null = null;
  const rows = () => (db[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
  const builder = {
    select: () => builder,
    eq: (k: string, v: unknown) => { filters.push([k, v]); return builder; },
    neq: () => builder,
    is: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    update: (values: Row) => { pendingUpdate = values; return builder; },
    insert: (newRows: Row[]) => { inserts.push({ table, rows: newRows }); return builder; },
    delete: () => builder,
    maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
    single: async () => ({ data: rows()[0] ?? null, error: null }),
    then: (resolve: (v: { data: Row[]; error: null }) => void) => {
      if (pendingUpdate) updates.push({ table, values: pendingUpdate, filters: [...filters] });
      resolve({ data: rows(), error: null });
    },
  };
  return builder;
}

const fakeSupabase = {
  from: (table: string) => queryBuilder(table),
  rpc: async () => ({ data: true, error: null }),
  auth: { getUser: async () => ({ data: { user: authUser }, error: authUser ? null : { message: 'invalid' } }) },
};

vi.mock('./_lib/server.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./_lib/server.js')>();
  return {
    ...original,
    env: { ...original.env, asaasApiKey: 'asaas-key', asaasBaseUrl: 'https://asaas.test/v3', asaasMock: false, geminiApiKey: 'g', asaasWebhookToken: '' },
    getSupabaseAdmin: () => fakeSupabase,
    getAuthUser: async (req: Request) => (req.headers.get('Authorization') ? authUser : null),
  };
});

const { POST: webhook } = await import('./webhook-asaas.js');
const { POST: chat } = await import('./chat.js');
const { POST: processDocument } = await import('./process-document.js');

let asaasPayments: Record<string, Row> = {};
let asaasSubscriptions: Record<string, Row> = {};

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  updates.length = 0;
  inserts.length = 0;
  authUser = null;
  asaasPayments = {};
  asaasSubscriptions = {};
  db.subscriptions = [{ id: '11111111-1111-1111-1111-111111111111', account_id: 'u1', status: 'blocked', plan_id: 'basic', gateway_subscription_id: 'sub_asaas_1' }];
  db.plans = [{ id: 'basic', price_cents: 5990 }, { id: 'family', price_cents: 7990 }];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const payment = url.match(/\/payments\/([\w-]+)$/);
    if (payment) return asaasPayments[payment[1]] ? new Response(JSON.stringify(asaasPayments[payment[1]])) : new Response('{}', { status: 404 });
    const sub = url.match(/\/subscriptions\/([\w-]+)$/);
    if (sub) return asaasSubscriptions[sub[1]] ? new Response(JSON.stringify(asaasSubscriptions[sub[1]])) : new Response('{}', { status: 404 });
    throw new Error('fetch inesperado: ' + url);
  }));
});

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://x/api', { method: 'POST', headers, body: JSON.stringify(body) });

const activated = () => updates.some((u) => u.table === 'subscriptions' && u.values.status === 'active');

describe('/api/webhook-asaas', () => {
  it('recusa o antigo "simular pagamento" em produção', async () => {
    const res = await webhook(post({ event: 'PAYMENT_RECEIVED', simulated: true, subscriptionId: '11111111-1111-1111-1111-111111111111' }));
    expect(res.status).toBe(403);
    expect(activated()).toBe(false);
  });

  it('não ativa com pagamento forjado (inexistente no Asaas)', async () => {
    const res = await webhook(post({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_fake', subscription: 'sub_asaas_1' } }));
    expect(res.status).toBe(404);
    expect(activated()).toBe(false);
  });

  it('não ativa se o pagamento ainda está pendente no Asaas', async () => {
    asaasPayments.pay_1 = { id: 'pay_1', status: 'PENDING', subscription: 'sub_asaas_1', value: 59.9 };
    await webhook(post({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_1' } }));
    expect(activated()).toBe(false);
  });

  it('ativa quando o Asaas confirma o pagamento e aplica o plano comprado', async () => {
    asaasPayments.pay_2 = { id: 'pay_2', status: 'RECEIVED', subscription: 'sub_asaas_1', value: 79.9, billingType: 'PIX' };
    asaasSubscriptions.sub_asaas_1 = { id: 'sub_asaas_1', externalReference: '11111111-1111-1111-1111-111111111111|family' };
    const res = await webhook(post({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_2' } }));
    expect(res.status).toBe(200);
    expect(activated()).toBe(true);
    expect(updates.some((u) => u.values.plan_id === 'family')).toBe(true);
    expect(inserts.find((i) => i.table === 'payment_transactions')?.rows[0]).toMatchObject({ gateway_transaction_id: 'pay_2', method: 'pix', amount_cents: 7990 });
  });

  it('recusa valor pago menor que o preço do plano', async () => {
    asaasPayments.pay_3 = { id: 'pay_3', status: 'RECEIVED', subscription: 'sub_asaas_1', value: 1, externalReference: '11111111-1111-1111-1111-111111111111|family' };
    const res = await webhook(post({ event: 'PAYMENT_CONFIRMED', payment: { id: 'pay_3' } }));
    expect(res.status).toBe(409);
    expect(activated()).toBe(false);
  });

  it('só cancela a assinatura se o Asaas confirmar que ela acabou', async () => {
    asaasSubscriptions.sub_asaas_1 = { id: 'sub_asaas_1', status: 'ACTIVE', deleted: false };
    await webhook(post({ event: 'SUBSCRIPTION_DELETED', subscription: { id: 'sub_asaas_1' } }));
    expect(updates.some((u) => u.values.status === 'canceled')).toBe(false);
  });
});

describe('autenticação das rotas de IA', () => {
  it('/api/chat exige login', async () => {
    const res = await chat(post({ messages: [{ role: 'user', content: 'oi' }], profileId: 'p1' }));
    expect(res.status).toBe(401);
  });

  it('/api/chat recusa perfil de outra conta', async () => {
    authUser = { id: 'u1', email: 'a@a.com' };
    db.profiles = [{ id: 'p-outro', account_id: 'u2', report_generated_at: null }];
    const res = await chat(post({ messages: [{ role: 'user', content: 'oi' }], profileId: 'p-outro' }, { Authorization: 'Bearer t' }));
    expect(res.status).toBe(404);
  });

  it('/api/chat devolve bloqueio quando a assinatura não dá acesso', async () => {
    authUser = { id: 'u1', email: 'a@a.com' };
    db.profiles = [{ id: 'p1', account_id: 'u1', report_generated_at: null }];
    const res = await chat(post({ messages: [{ role: 'user', content: 'oi' }], profileId: 'p1' }, { Authorization: 'Bearer t' }));
    expect(await res.json()).toMatchObject({ blocked: true, blockReason: 'blocked' });
  });

  it('/api/process-document exige login', async () => {
    const res = await processDocument(post({ mimeType: 'application/pdf', data: 'JVBERi0xLjQ=' }));
    expect(res.status).toBe(401);
  });

  it('/api/process-document recusa arquivo que não é PDF', async () => {
    authUser = { id: 'u1', email: 'a@a.com' };
    const res = await processDocument(post({ mimeType: 'application/pdf', data: 'aGVsbG8=' }, { Authorization: 'Bearer t' }));
    expect(res.status).toBe(400);
  });
});
