// ==========================================
// UTILITÁRIOS COMPARTILHADOS DAS ROTAS /api
// ==========================================
// Arquivos dentro de api/_lib não viram rotas na Vercel (prefixo "_").
// ==========================================

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

declare const process: {
  env: Record<string, string | undefined>;
};

export const env = {
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-flash-latest',
  asaasApiKey: process.env.ASAAS_API_KEY || '',
  // Padrão = sandbox (mesmo comportamento de antes). Em produção: ASAAS_BASE_URL=https://api.asaas.com/v3
  asaasBaseUrl: (process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3').replace(/\/+$/, ''),
  asaasWebhookToken: process.env.ASAAS_WEBHOOK_TOKEN || '',
  // Modo simulação do gateway: só quando pedido explicitamente e nunca em produção.
  asaasMock: process.env.ASAAS_MOCK === 'true' && process.env.VERCEL_ENV !== 'production',
};

export function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

let adminClient: SupabaseClient | null = null;

/** Cliente Supabase com service role (ignora RLS — use sempre filtrando pelo usuário autenticado). */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!env.supabaseUrl || !env.serviceKey) return null;
  if (!adminClient) {
    adminClient = createClient(env.supabaseUrl, env.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

/** Valida o JWT do Supabase enviado no cabeçalho Authorization. */
export async function getAuthUser(req: Request): Promise<User | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return null;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/** Lê o corpo JSON respeitando um limite de tamanho. Retorna null se inválido ou grande demais. */
export async function readJsonBody<T>(req: Request, maxChars: number): Promise<{ body: T } | { error: Response }> {
  const raw = await req.text();
  if (raw.length > maxChars) {
    return { error: jsonResponse({ error: 'Requisição muito grande.' }, 413) };
  }
  try {
    return { body: JSON.parse(raw) as T };
  } catch {
    return { error: jsonResponse({ error: 'JSON inválido.' }, 400) };
  }
}

/**
 * Rate limit por usuário (função check_rate_limit no Supabase — ver
 * supabase/migrations/20261009_security_hardening.sql).
 * Se a função ainda não existir, deixa passar e registra o aviso.
 */
export async function checkRateLimit(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_rate_limit', { p_user_id: userId });
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      console.error('Rate limit DESATIVADO: função check_rate_limit não existe. Rode a migration supabase/migrations/20261009_security_hardening.sql.');
      return true;
    }
    console.error('Falha ao verificar rate limit:', error);
    return false;
  }
  return data === true;
}

// ── Assinaturas ───────────────────────────

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'blocked';

export interface SubscriptionRow {
  id: string;
  account_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  gateway: string | null;
  gateway_subscription_id: string | null;
  created_at: string;
  updated_at: string | null;
  plans?: { name: string; price_cents: number; max_profiles: number; max_messages_post_report: number } | null;
}

export type BlockReason = 'blocked' | 'expired' | 'past_due_expired' | 'canceled';

export const PAST_DUE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/** Regras de acesso a partir do estado da assinatura (função pura, testável). */
export function evaluateSubscriptionAccess(
  sub: Pick<SubscriptionRow, 'status' | 'trial_ends_at' | 'updated_at' | 'created_at'> | null,
  now: Date = new Date()
): { allowed: true } | { allowed: false; reason: BlockReason; shouldPersistBlock: boolean } {
  if (!sub) return { allowed: false, reason: 'blocked', shouldPersistBlock: false };

  switch (sub.status) {
    case 'active':
      return { allowed: true };
    case 'trial':
      if (sub.trial_ends_at && new Date(sub.trial_ends_at) < now) {
        return { allowed: false, reason: 'expired', shouldPersistBlock: true };
      }
      return { allowed: true };
    case 'past_due': {
      const since = new Date(sub.updated_at || sub.created_at).getTime();
      if (now.getTime() - since > PAST_DUE_GRACE_MS) {
        return { allowed: false, reason: 'past_due_expired', shouldPersistBlock: true };
      }
      return { allowed: true };
    }
    case 'canceled':
      return { allowed: false, reason: 'canceled', shouldPersistBlock: false };
    default:
      return { allowed: false, reason: 'blocked', shouldPersistBlock: false };
  }
}

export const BLOCK_MESSAGES: Record<BlockReason | 'limit_reached', string> = {
  blocked: 'Seu acesso está suspenso. Faça o upgrade ou regularize sua assinatura para continuar organizando suas finanças.',
  expired: 'Seu período de teste gratuito de 90 dias do plano BETA expirou. Faça o upgrade agora para um plano pago para liberar o chat.',
  past_due_expired: 'Sua assinatura está atrasada há mais de 3 dias. O acesso ao chat foi temporariamente bloqueado até a confirmação do pagamento.',
  canceled: 'Sua assinatura foi cancelada. Escolha um plano para voltar a usar o chat.',
  limit_reached: 'Você atingiu seu limite diário de hoje. Volte amanhã para continuar sua jornada de organização financeira.',
};

/** Busca a assinatura do usuário (criada pelo trigger on_auth_user_created). */
export async function loadSubscription(supabase: SupabaseClient, userId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, plans(*)')
    .eq('account_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Erro ao carregar assinatura:', error);
    return null;
  }
  return data as SubscriptionRow | null;
}

/** Verifica a assinatura e, se necessário, grava o bloqueio no banco. */
export async function checkSubscriptionAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<{ allowed: true; subscription: SubscriptionRow } | { allowed: false; reason: BlockReason; subscription: SubscriptionRow | null }> {
  const subscription = await loadSubscription(supabase, userId);
  const access = evaluateSubscriptionAccess(subscription);

  if (!('reason' in access) && subscription) {
    return { allowed: true, subscription };
  }
  if ('reason' in access) {
    if (access.shouldPersistBlock && subscription) {
      await supabase
        .from('subscriptions')
        .update({ status: 'blocked', updated_at: new Date().toISOString() })
        .eq('id', subscription.id);
    }
    return { allowed: false, reason: access.reason, subscription };
  }
  return { allowed: false, reason: 'blocked', subscription };
}

/** Data de hoje no fuso de São Paulo (YYYY-MM-DD). */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return now.toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' });
}

// ── Gemini ────────────────────────────────

/** Junta o texto de todas as partes da primeira candidata (ignora partes de "raciocínio"). */
export function extractGeminiText(data: unknown): string {
  const parts = (data as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] })
    ?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('');
}

/** Limpa o JSON vindo da IA (blocos markdown, comentários e vírgulas sobrando). */
export function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  cleaned = cleaned.replace(/```[a-zA-Z]*\n?/gi, '').replace(/```/g, '').trim();
  cleaned = cleaned.replace(/(?<![:"])\/\/.*$/gm, '');
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
  return cleaned.trim();
}

/** Extrai o JSON de um bloco <tag>...</tag> e remove o bloco do texto visível. */
export function extractTaggedJson(rawContent: string, tag: string): { visibleText: string; json: string | null } {
  const blockRegex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
  let json: string | null = null;
  const match = rawContent.match(blockRegex);
  if (match) {
    try {
      const cleaned = cleanJsonString(match[1]);
      JSON.parse(cleaned);
      json = cleaned;
    } catch (e) {
      console.warn(`IA retornou um bloco <${tag}> com JSON inválido:`, e);
    }
  }

  let visibleText = rawContent.replace(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`, 'gi'), '').trim();
  // Bloco truncado (sem tag de fechamento)
  visibleText = visibleText.replace(new RegExp(`<${tag}>[\\s\\S]*`, 'gi'), '').trim();
  return { visibleText, json };
}
