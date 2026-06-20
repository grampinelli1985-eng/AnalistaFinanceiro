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

    const { planId, method, installments, cardInfo } = await req.json();

    if (!planId || !method) {
      return new Response(JSON.stringify({ error: 'Plano e método de pagamento são obrigatórios.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Buscar plano
    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: 'Plano não encontrado.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Buscar ou criar assinatura
    let { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('account_id', user.id)
      .maybeSingle();

    if (subError) {
      return new Response(JSON.stringify({ error: 'Erro ao buscar assinatura.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!subscription) {
      // Criar nova assinatura
      const { data: newSub, error: createError } = await supabase
        .from('subscriptions')
        .insert([{
          account_id: user.id,
          plan_id: planId,
          status: 'past_due' // pendente de pagamento
        }])
        .select()
        .single();

      if (createError || !newSub) {
        return new Response(JSON.stringify({ error: 'Erro ao criar assinatura no banco.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      subscription = newSub;
    }

    const asaasApiKey = process.env.ASAAS_API_KEY;

    // --- SE NÃO HOUVER API KEY DO ASAAS, SIMULA O GATEWAY ---
    if (!asaasApiKey) {
      console.log('Asaas API Key não configurada. Executando modo SIMULAÇÃO.');

      if (method === 'pix') {
        const mockQrCode = '00020126580014br.gov.bcb.pix0136mock-pix-key-for-analista-financeiro-ia520400005303986540559.905802BR5913Analista IA6009Sao Paulo62070503***6304ABCD';
        return new Response(JSON.stringify({
          success: true,
          method: 'pix',
          amount: plan.price_cents / 100,
          qrCode: mockQrCode,
          qrCodeImage: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(mockQrCode),
          copiaECola: mockQrCode,
          subscriptionId: subscription.id,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (method === 'boleto') {
        const mockBarcode = '00190.00009 01234.567890 12345.678901 2 9876000000' + plan.price_cents;
        return new Response(JSON.stringify({
          success: true,
          method: 'boleto',
          amount: plan.price_cents / 100,
          barcode: mockBarcode,
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
          subscriptionId: subscription.id,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (method === 'cartao') {
        // Simular aprovação imediata do cartão
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            plan_id: planId,
            trial_started_at: null,
            trial_ends_at: null,
            gateway: 'asaas_mock',
            gateway_subscription_id: 'sub_mock_' + Math.random().toString(36).substring(7),
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id);

        if (updateError) {
          return new Response(JSON.stringify({ error: 'Erro ao atualizar assinatura.' }), { status: 500 });
        }

        // Criar transação de pagamento
        await supabase
          .from('payment_transactions')
          .insert([{
            subscription_id: subscription.id,
            gateway_transaction_id: 'pay_mock_' + Math.random().toString(36).substring(7),
            method: 'cartao',
            installments: installments || 1,
            amount_cents: plan.price_cents,
            status: 'paid',
            paid_at: new Date().toISOString()
          }]);

        return new Response(JSON.stringify({
          success: true,
          method: 'cartao',
          message: 'Pagamento aprovado com sucesso! Plano ativo.',
          subscriptionId: subscription.id,
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // --- SE HOUVER API KEY DO ASAAS, INTEGRA COM O ASAAS REAL ---
    const headers = {
      'Content-Type': 'application/json',
      'access_token': asaasApiKey,
    };

    // 1. Criar ou Obter Cliente no Asaas
    const customerPayload = {
      name: user.user_metadata?.name || 'Cliente Analista Financeiro',
      email: user.email,
      externalReference: user.id,
    };

    const customerRes = await fetch('https://sandbox.asaas.com/api/v3/customers?email=' + encodeURIComponent(user.email || ''), {
      method: 'GET',
      headers,
    });
    
    let customerData = await customerRes.json();
    let customerId = customerData.data?.[0]?.id;

    if (!customerId) {
      const createCustRes = await fetch('https://sandbox.asaas.com/api/v3/customers', {
        method: 'POST',
        headers,
        body: JSON.stringify(customerPayload),
      });
      const newCust = await createCustRes.json();
      customerId = newCust.id;
      if (!customerId) {
        throw new Error('Falha ao criar cliente no Asaas: ' + JSON.stringify(newCust));
      }
    }

    // 2. Criar Cobrança (Assinatura Recorrente no Asaas)
    const asaasSubPayload: any = {
      customer: customerId,
      billingType: method === 'pix' ? 'PIX' : (method === 'boleto' ? 'BOLETO' : 'CREDIT_CARD'),
      value: plan.price_cents / 100,
      nextDueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 dias para pagar
      cycle: 'YEARLY',
      description: 'Assinatura ' + plan.name + ' - Analista Financeiro IA',
      externalReference: subscription.id,
    };

    if (method === 'cartao' && cardInfo) {
      asaasSubPayload.creditCard = {
        holderName: cardInfo.holderName,
        number: cardInfo.number,
        expiryMonth: cardInfo.expiryMonth,
        expiryYear: cardInfo.expiryYear,
        ccv: cardInfo.ccv,
      };
      asaasSubPayload.creditCardHolderInfo = {
        name: cardInfo.holderName,
        email: user.email,
        cpfCnpj: cardInfo.cpf,
        postalCode: cardInfo.postalCode,
        addressNumber: cardInfo.addressNumber,
        phone: cardInfo.phone || '11999999999',
      };
    }

    const subCreateRes = await fetch('https://sandbox.asaas.com/api/v3/subscriptions', {
      method: 'POST',
      headers,
      body: JSON.stringify(asaasSubPayload),
    });

    const asaasSub = await subCreateRes.json();

    if (!subCreateRes.ok || asaasSub.errors) {
      return new Response(JSON.stringify({ error: asaasSub.errors?.[0]?.description || 'Erro ao processar assinatura no Asaas.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Atualizar Assinatura local com o ID do gateway
    await supabase
      .from('subscriptions')
      .update({
        gateway: 'asaas',
        gateway_subscription_id: asaasSub.id,
        plan_id: planId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    // 4. Obter dados de pagamento imediato (QR Code PIX ou boleto bancário se não for cartão)
    if (method === 'pix') {
      const payId = asaasSub.paymentId || (await fetch(`https://sandbox.asaas.com/api/v3/subscriptions/${asaasSub.id}/payments`, { headers }))
        .json()
        .then((d: any) => d.data?.[0]?.id);

      const pixRes = await fetch(`https://sandbox.asaas.com/api/v3/payments/${payId}/pixQrCode`, { headers });
      const pixData = await pixRes.json();

      return new Response(JSON.stringify({
        success: true,
        method: 'pix',
        amount: plan.price_cents / 100,
        qrCode: pixData.payload,
        qrCodeImage: 'data:image/png;base64,' + pixData.encodedImage,
        copiaECola: pixData.payload,
        subscriptionId: subscription.id,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    if (method === 'boleto') {
      const payId = asaasSub.paymentId || (await fetch(`https://sandbox.asaas.com/api/v3/subscriptions/${asaasSub.id}/payments`, { headers }))
        .json()
        .then((d: any) => d.data?.[0]?.id);

      const payRes = await fetch(`https://sandbox.asaas.com/api/v3/payments/${payId}`, { headers });
      const payData = await payRes.json();

      return new Response(JSON.stringify({
        success: true,
        method: 'boleto',
        amount: plan.price_cents / 100,
        barcode: payData.identificationField,
        dueDate: payData.dueDate,
        bankSlipUrl: payData.bankSlipUrl,
        subscriptionId: subscription.id,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // Se for cartão
    return new Response(JSON.stringify({
      success: true,
      method: 'cartao',
      message: 'Cobrança do cartão processada no Asaas.',
      subscriptionId: subscription.id,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Erro interno no servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
