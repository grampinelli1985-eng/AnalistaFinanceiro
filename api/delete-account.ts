// ==========================================
// EXCLUSÃO DEFINITIVA DE CONTA (LGPD — Art. 18)
// ==========================================
// Cancela a cobrança recorrente no Asaas, apaga todos os dados do usuário
// e remove o próprio usuário do Supabase Auth. Precisa da service role,
// por isso não pode ser feito pelo navegador.
// ==========================================

import { env, jsonResponse, getSupabaseAdmin, getAuthUser } from './_lib/server.js';

export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return jsonResponse({ error: 'Servidor não configurado corretamente.' }, 500);
    }

    const user = await getAuthUser(req);
    if (!user) {
      return jsonResponse({ error: 'Não autorizado. Faça login novamente.' }, 401);
    }

    // 1. Cancela cobranças recorrentes para não continuar cobrando depois da exclusão
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('gateway, gateway_subscription_id')
      .eq('account_id', user.id);

    if (env.asaasApiKey) {
      for (const sub of subscriptions ?? []) {
        if (sub.gateway !== 'asaas' || !sub.gateway_subscription_id) continue;
        const res = await fetch(`${env.asaasBaseUrl}/subscriptions/${sub.gateway_subscription_id}`, {
          method: 'DELETE',
          headers: { access_token: env.asaasApiKey },
        }).catch(() => null);
        if (!res || (!res.ok && res.status !== 404)) {
          console.error('Exclusão de conta: falha ao cancelar assinatura no Asaas', sub.gateway_subscription_id, res?.status);
          return jsonResponse({ error: 'Não foi possível cancelar sua cobrança recorrente. Tente novamente em alguns instantes.' }, 502);
        }
      }
    }

    // 2. Apaga os dados do usuário (perfis e tudo que pertence a eles)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .eq('account_id', user.id);
    if (profilesError) throw profilesError;

    const profileIds = (profiles ?? []).map((p) => p.id);
    if (profileIds.length > 0) {
      for (const table of ['financial_data', 'chat_history', 'monthly_snapshots']) {
        const { error } = await supabase.from(table).delete().in('profile_id', profileIds);
        if (error) throw error;
      }
      const { error } = await supabase.from('profiles').delete().in('id', profileIds);
      if (error) throw error;
    }

    const { error: familyError } = await supabase.from('family_view_config').delete().eq('account_id', user.id);
    if (familyError) throw familyError;

    // 3. Remove o usuário do Auth (subscriptions, message_usage etc. caem em cascata)
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteUserError) throw deleteUserError;

    return jsonResponse({ success: true });
  } catch (err) {
    console.error('Erro inesperado em /api/delete-account:', err);
    return jsonResponse({ error: 'Erro ao excluir a conta. Tente novamente ou entre em contato com o suporte.' }, 500);
  }
}
