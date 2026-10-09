// ==========================================
// WEBHOOK DO ASAAS
// ==========================================
// Segurança: o corpo do webhook NUNCA é tratado como verdade. Para cada
// evento, o pagamento/assinatura é consultado de novo na API do Asaas com a
// nossa chave — assim ninguém consegue "forjar" um pagamento chamando esta
// rota diretamente. Se ASAAS_WEBHOOK_TOKEN estiver configurado, o cabeçalho
// asaas-access-token também é exigido.
// ==========================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { env, jsonResponse, getSupabaseAdmin, readJsonBody } from './_lib/server.js';

export const maxDuration = 30;

const PAID_STATUSES = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);
const PAID_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
const OVERDUE_EVENTS = new Set(['PAYMENT_OVERDUE']);
const REVERSAL_EVENTS = new Set(['PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_CHARGEBACK_DISPUTE']);
const REVERSAL_STATUSES = new Set(['REFUNDED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE']);
const SUBSCRIPTION_END_EVENTS = new Set(['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED', 'SUBSCRIPTION_CANCELED']);

interface AsaasPayment {
  id: string;
  status: string;
  subscription?: string | null;
  value: number;
  billingType?: string;
  installmentCount?: number | null;
  externalReference?: string | null;
  paymentDate?: string | null;
  confirmedDate?: string | null;
}

interface AsaasSubscription {
  id: string;
  status?: string;
  deleted?: boolean;
  externalReference?: string | null;
}

/** O checkout grava "<id local da assinatura>|<plano>" no externalReference da assinatura no Asaas. */
export function parseExternalReference(ref?: string | null): { localId: string | null; planId: string | null } {
  if (!ref) return { localId: null, planId: null };
  const [localId, planId] = ref.split('|');
  return { localId: localId || null, planId: planId === 'basic' || planId === 'family' ? planId : null };
}

interface WebhookBody {
  event?: string;
  payment?: { id?: string; subscription?: string };
  subscription?: { id?: string };
  // Apenas em modo simulação (ASAAS_MOCK=true fora de produção)
  simulated?: boolean;
  subscriptionId?: string;
  method?: string;
}

function asaasHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json', access_token: env.asaasApiKey };
}

async function fetchAsaas<T>(path: string): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const res = await fetch(`${env.asaasBaseUrl}${path}`, { headers: asaasHeaders() });
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, data: (await res.json()) as T };
}

async function findSubscription(supabase: SupabaseClient, gatewaySubscriptionId?: string | null, localId?: string | null) {
  if (gatewaySubscriptionId) {
    const { data } = await supabase
      .from('subscriptions')
      .select('id, status, plan_id, plans(price_cents)')
      .eq('gateway_subscription_id', gatewaySubscriptionId)
      .maybeSingle();
    if (data) return data;
  }
  if (localId && /^[0-9a-f-]{36}$/i.test(localId)) {
    const { data } = await supabase
      .from('subscriptions')
      .select('id, status, plan_id, plans(price_cents)')
      .eq('id', localId)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

async function activateSubscription(
  supabase: SupabaseClient,
  subscriptionId: string,
  transaction: { gatewayId: string; method: string; installments: number; amountCents: number; paidAt: string }
): Promise<Response> {
  // Idempotência: o Asaas pode reenviar o mesmo evento várias vezes
  const { data: existing } = await supabase
    .from('payment_transactions')
    .select('id')
    .eq('gateway_transaction_id', transaction.gatewayId)
    .maybeSingle();

  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      trial_started_at: null, // zera trial pois virou pago
      trial_ends_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);

  if (updateError) {
    console.error('Erro ao atualizar assinatura no webhook:', updateError);
    return jsonResponse({ error: 'Erro ao atualizar assinatura local' }, 500);
  }

  if (!existing) {
    const { error: txError } = await supabase.from('payment_transactions').insert([{
      subscription_id: subscriptionId,
      gateway_transaction_id: transaction.gatewayId,
      method: transaction.method,
      installments: transaction.installments,
      amount_cents: transaction.amountCents,
      status: 'paid',
      paid_at: transaction.paidAt,
    }]);
    if (txError) console.error('Erro ao registrar transação:', txError);
  }

  return jsonResponse({ success: true, message: 'Assinatura ativada com sucesso.' });
}

function normalizeMethod(billingType?: string): string {
  switch (billingType) {
    case 'PIX': return 'pix';
    case 'BOLETO': return 'boleto';
    case 'CREDIT_CARD': return 'cartao';
    default: return (billingType || 'pix').toLowerCase();
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error('Webhook: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados.');
      return jsonResponse({ error: 'Servidor não configurado' }, 500);
    }

    if (env.asaasWebhookToken && req.headers.get('asaas-access-token') !== env.asaasWebhookToken) {
      return jsonResponse({ error: 'Não autorizado' }, 401);
    }

    const parsed = await readJsonBody<WebhookBody>(req, 100_000);
    if ('error' in parsed) return parsed.error;
    const body = parsed.body;
    const eventType = body.event || '';

    // ── Modo simulação (somente desenvolvimento) ──
    if (body.simulated === true) {
      if (!env.asaasMock) {
        return jsonResponse({ error: 'Simulação de pagamento desativada.' }, 403);
      }
      const sub = await findSubscription(supabase, null, body.subscriptionId);
      if (!sub) return jsonResponse({ error: 'Assinatura não localizada no sistema.' }, 404);
      const plan = Array.isArray(sub.plans) ? sub.plans[0] : sub.plans;
      return activateSubscription(supabase, sub.id, {
        gatewayId: 'pay_mock_' + crypto.randomUUID(),
        method: body.method || 'pix',
        installments: 1,
        amountCents: (plan as { price_cents?: number } | null)?.price_cents ?? 0,
        paidAt: new Date().toISOString(),
      });
    }

    if (!env.asaasApiKey) {
      console.error('Webhook: ASAAS_API_KEY não configurada — impossível confirmar o evento no Asaas.');
      return jsonResponse({ error: 'Servidor não configurado' }, 500);
    }

    console.log(`Webhook Asaas: evento ${eventType}, pagamento ${body.payment?.id ?? '-'}, assinatura ${body.payment?.subscription ?? body.subscription?.id ?? '-'}`);

    // ── Eventos de pagamento: sempre reconsultar o pagamento no Asaas ──
    if (PAID_EVENTS.has(eventType) || OVERDUE_EVENTS.has(eventType) || REVERSAL_EVENTS.has(eventType)) {
      const paymentId = body.payment?.id;
      if (!paymentId || !/^[\w-]+$/.test(paymentId)) {
        return jsonResponse({ error: 'Pagamento não informado.' }, 400);
      }

      const result = await fetchAsaas<AsaasPayment>(`/payments/${paymentId}`);
      if (!result.ok) {
        console.error(`Webhook: pagamento ${paymentId} não encontrado no Asaas (HTTP ${result.status}).`);
        return jsonResponse({ error: 'Pagamento não confirmado no gateway.' }, result.status === 404 ? 404 : 502);
      }
      const payment = result.data;

      // O plano comprado fica no externalReference da assinatura do Asaas
      let reference = parseExternalReference(payment.externalReference);
      if (payment.subscription && !reference.planId) {
        const subResult = await fetchAsaas<AsaasSubscription>(`/subscriptions/${payment.subscription}`);
        if (subResult.ok) reference = parseExternalReference(subResult.data.externalReference);
      }

      const sub = await findSubscription(supabase, payment.subscription, reference.localId);
      if (!sub) {
        return jsonResponse({ error: 'Assinatura não localizada no sistema.' }, 404);
      }

      if (PAID_EVENTS.has(eventType)) {
        if (!PAID_STATUSES.has(payment.status)) {
          return jsonResponse({ success: true, message: `Pagamento com status ${payment.status} — nada a fazer.` });
        }

        const planId = reference.planId || sub.plan_id;
        const { data: plan } = await supabase.from('plans').select('price_cents').eq('id', planId).maybeSingle();
        const expectedCents = plan?.price_cents ?? Number.POSITIVE_INFINITY;
        const paidCents = Math.round(payment.value * 100);
        if (paidCents < expectedCents) {
          console.error(`Webhook: valor pago (${paidCents}) menor que o preço do plano ${planId} (${expectedCents}) na assinatura ${sub.id}.`);
          return jsonResponse({ error: 'Valor pago divergente do plano.' }, 409);
        }
        if (planId !== sub.plan_id) {
          await supabase.from('subscriptions').update({ plan_id: planId }).eq('id', sub.id);
        }
        return activateSubscription(supabase, sub.id, {
          gatewayId: payment.id,
          method: normalizeMethod(payment.billingType),
          installments: payment.installmentCount || 1,
          amountCents: paidCents,
          paidAt: payment.confirmedDate || payment.paymentDate || new Date().toISOString(),
        });
      }

      if (OVERDUE_EVENTS.has(eventType)) {
        // Só rebaixa quem está ativo; não mexe em bloqueados/cancelados
        if (payment.status === 'OVERDUE' && sub.status === 'active') {
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('id', sub.id);
        }
        return jsonResponse({ success: true });
      }

      // Estorno / chargeback
      if (REVERSAL_STATUSES.has(payment.status)) {
        await supabase
          .from('subscriptions')
          .update({ status: 'blocked', updated_at: new Date().toISOString() })
          .eq('id', sub.id);
        await supabase
          .from('payment_transactions')
          .update({ status: 'refunded' })
          .eq('gateway_transaction_id', payment.id);
      }
      return jsonResponse({ success: true });
    }

    // ── Assinatura encerrada no Asaas: confirmar antes de cancelar ──
    if (SUBSCRIPTION_END_EVENTS.has(eventType)) {
      const gatewaySubId = body.subscription?.id || body.payment?.subscription;
      if (!gatewaySubId || !/^[\w-]+$/.test(gatewaySubId)) {
        return jsonResponse({ success: true, message: 'Evento sem assinatura — ignorado.' });
      }

      const result = await fetchAsaas<AsaasSubscription>(`/subscriptions/${gatewaySubId}`);
      const reallyEnded = !result.ok
        ? result.status === 404
        : result.data.deleted === true || result.data.status === 'INACTIVE' || result.data.status === 'EXPIRED';

      if (reallyEnded) {
        await supabase
          .from('subscriptions')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('gateway_subscription_id', gatewaySubId)
          .neq('status', 'canceled');
      }
      return jsonResponse({ success: true });
    }

    // Retorna OK para eventos não tratados (para não travar a fila do webhook no Asaas)
    return jsonResponse({ success: true, message: 'Evento ignorado' });
  } catch (err) {
    console.error('Erro no Webhook:', err);
    return jsonResponse({ error: 'Erro interno' }, 500);
  }
}
