import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

declare const process: {
  env: {
    VITE_SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
    ASAAS_WEBHOOK_TOKEN?: string; // Token de segurança configurado no painel do Asaas
  };
};

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await req.json();
    const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN;

    // Se houver token configurado, valida a origem
    if (webhookToken) {
      const requestToken = req.headers.get('asaas-access-token');
      if (requestToken !== webhookToken) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 });
      }
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const eventType = body.event;
    
    // Asaas envia os dados do pagamento dentro de body.payment
    const payment = body.payment || {};
    const subscriptionIdGateway = payment.subscription;
    const paymentIdGateway = payment.id;
    const billingType = payment.billingType;
    const value = payment.value; // em reais (ex: 59.90)

    console.log(`Recebido evento Webhook Asaas: ${eventType}`, body);

    // --- PROCESSAR EVENTO DE CONFIRMAÇÃO DE PAGAMENTO ---
    if (eventType === 'PAYMENT_RECEIVED' || eventType === 'PAYMENT_CONFIRMED' || body.simulated === true) {
      let sub;

      // Buscar assinatura pelo id da assinatura no gateway ou pelo account_id diretamente se for simulação
      if (body.simulated === true && body.subscriptionId) {
        // Modo de simulação fácil para o frontend
        const { data } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('id', body.subscriptionId)
          .single();
        sub = data;
      } else if (subscriptionIdGateway) {
        const { data } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('gateway_subscription_id', subscriptionIdGateway)
          .maybeSingle();
        sub = data;
      }

      if (!sub) {
        // Tentar buscar por id da cobrança de pagamento direta se não tiver assinatura
        const externalReference = payment.externalReference || body.externalReference;
        if (externalReference) {
          const { data } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('id', externalReference)
            .maybeSingle();
          sub = data;
        }
      }

      if (!sub) {
        return new Response(JSON.stringify({ error: 'Assinatura não localizada no sistema.' }), { status: 404 });
      }

      // Atualizar status para ativo
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          trial_started_at: null, // zera trial pois virou pago
          trial_ends_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', sub.id);

      if (updateError) {
        console.error('Erro ao atualizar assinatura no webhook:', updateError);
        return new Response(JSON.stringify({ error: 'Erro ao atualizar assinatura local' }), { status: 500 });
      }

      // Registrar transação de pagamento
      const amountCents = value ? Math.round(value * 100) : (body.amount_cents || 5990);
      await supabase
        .from('payment_transactions')
        .insert([{
          subscription_id: sub.id,
          gateway_transaction_id: paymentIdGateway || ('pay_' + Math.random().toString(36).substring(7)),
          method: (billingType || body.method || 'pix').toLowerCase(),
          installments: payment.installments || body.installments || 1,
          amount_cents: amountCents,
          status: 'paid',
          paid_at: new Date().toISOString()
        }]);

      return new Response(JSON.stringify({ success: true, message: 'Assinatura ativada com sucesso.' }), { status: 200 });
    }

    // --- COBRANÇA EM ATRASO / VENCIDA ---
    if (eventType === 'PAYMENT_OVERDUE' || eventType === 'PAYMENT_DUNNING_RECEIVED') {
      if (subscriptionIdGateway) {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('gateway_subscription_id', subscriptionIdGateway)
          .maybeSingle();

        if (sub) {
          await supabase
            .from('subscriptions')
            .update({
              status: 'past_due',
              updated_at: new Date().toISOString()
            })
            .eq('id', sub.id);
        }
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    // --- ASSINATURA CANCELADA / REMOVIDA ---
    if (eventType === 'SUBSCRIPTION_CANCELED' || eventType === 'SUBSCRIPTION_DELETED' || eventType === 'PAYMENT_DELETED') {
      if (subscriptionIdGateway) {
        const { data: sub } = await supabase
          .from('subscriptions')
          .select('id')
          .eq('gateway_subscription_id', subscriptionIdGateway)
          .maybeSingle();

        if (sub) {
          await supabase
            .from('subscriptions')
            .update({
              status: 'canceled',
              updated_at: new Date().toISOString()
            })
            .eq('id', sub.id);
        }
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    // Retorna OK para eventos não tratados (para não travar webhook do Asaas)
    return new Response(JSON.stringify({ success: true, message: 'Evento ignorado' }), { status: 200 });

  } catch (err: any) {
    console.error('Erro no Webhook:', err);
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }), { status: 500 });
  }
}
