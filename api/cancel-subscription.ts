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

    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('account_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError || !subscription) {
      return jsonResponse({ error: 'Nenhuma assinatura encontrada para essa conta.' }, 404);
    }

    if (subscription.status === 'canceled') {
      return jsonResponse({ success: true, message: 'Assinatura já estava cancelada.' });
    }

    // Se existir uma assinatura recorrente real no Asaas, cancela ela também.
    // Removida a assinatura, o próprio Asaas já remove as mensalidades pendentes.
    if (env.asaasApiKey && subscription.gateway === 'asaas' && subscription.gateway_subscription_id) {
      const res = await fetch(`${env.asaasBaseUrl}/subscriptions/${subscription.gateway_subscription_id}`, {
        method: 'DELETE',
        headers: { access_token: env.asaasApiKey },
      }).catch((err) => {
        console.error('Erro de rede ao cancelar assinatura no Asaas:', err);
        return null;
      });

      if (!res || (!res.ok && res.status !== 404)) {
        console.error('Asaas recusou o cancelamento da assinatura:', res?.status);
        return jsonResponse({ error: 'Não foi possível cancelar a cobrança no gateway. Tente novamente em alguns instantes.' }, 502);
      }
    }

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('id', subscription.id);

    if (updateError) {
      console.error('Erro ao cancelar assinatura no banco:', updateError);
      return jsonResponse({ error: 'Erro ao cancelar assinatura no banco.' }, 500);
    }

    return jsonResponse({ success: true, message: 'Assinatura cancelada com sucesso.' });
  } catch (err) {
    console.error('Erro inesperado em /api/cancel-subscription:', err);
    return jsonResponse({ error: 'Erro interno no servidor.' }, 500);
  }
}
