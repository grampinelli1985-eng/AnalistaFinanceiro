import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

declare const process: {
  env: {
    VITE_SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    ASAAS_API_KEY?: string;
  };
};

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ASAAS_BASE_URL = 'https://api-sandbox.asaas.com/v3';

async function getAuthUser(req: Request) {
  if (!supabaseUrl || !serviceKey) return null;
  const supabase = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();

  if (!token) return null;

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function POST(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const user = await getAuthUser(req);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Não autorizado. Faça login novamente.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('account_id', user.id)
      .maybeSingle();

    if (subError || !subscription) {
      return new Response(JSON.stringify({ error: 'Nenhuma assinatura encontrada para essa conta.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (subscription.status === 'canceled') {
      return new Response(JSON.stringify({ success: true, message: 'Assinatura já estava cancelada.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const asaasApiKey = process.env.ASAAS_API_KEY;

    // Se existir uma assinatura recorrente real no Asaas, cancela ela também.
    // Removida a assinatura, o próprio Asaas já remove as mensalidades pendentes.
    if (asaasApiKey && subscription.gateway_subscription_id) {
      try {
        await fetch(`${ASAAS_BASE_URL}/subscriptions/${subscription.gateway_subscription_id}`, {
          method: 'DELETE',
          headers: { 'access_token': asaasApiKey },
        });
      } catch (err) {
        console.error('Erro ao cancelar assinatura no Asaas (seguindo mesmo assim):', err);
      }
    }

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('id', subscription.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Erro ao cancelar assinatura no banco.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'Assinatura cancelada com sucesso.' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Erro interno no servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
