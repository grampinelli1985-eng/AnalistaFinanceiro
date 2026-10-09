import { env, jsonResponse, getSupabaseAdmin, getAuthUser, readJsonBody } from './_lib/server.js';

export const maxDuration = 30;

const PAID_PLANS = new Set(['basic', 'family']);
const METHODS = new Set(['pix', 'boleto', 'cartao']);

interface CardInfo {
  holderName?: string;
  number?: string;
  expiryMonth?: string;
  expiryYear?: string;
  ccv?: string;
  postalCode?: string;
  addressNumber?: string;
  phone?: string;
}

interface CheckoutBody {
  planId?: unknown;
  method?: unknown;
  installments?: unknown;
  cardInfo?: CardInfo;
  cpfCnpj?: unknown;
}

async function getFirstPaymentId(subscriptionId: string, headers: Record<string, string>): Promise<string | null> {
  // O Asaas pode levar um instante para gerar a primeira cobrança da assinatura.
  // Tenta algumas vezes com espera antes de desistir.
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${env.asaasBaseUrl}/subscriptions/${subscriptionId}/payments`, { headers });
      if (res.ok) {
        const data = await res.json();
        const id = data?.data?.[0]?.id;
        if (id) return id;
      }
    } catch {
      // tenta novamente na próxima iteração
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  return null;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error('Checkout: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados.');
      return jsonResponse({ error: 'Servidor não configurado corretamente.' }, 500);
    }

    const user = await getAuthUser(req);
    if (!user) {
      return jsonResponse({ error: 'Não autorizado. Faça login novamente.' }, 401);
    }

    const parsed = await readJsonBody<CheckoutBody>(req, 20_000);
    if ('error' in parsed) return parsed.error;
    const { planId, method, installments, cardInfo, cpfCnpj } = parsed.body;

    const cpfDigits = typeof cpfCnpj === 'string' ? cpfCnpj.replace(/\D/g, '') : '';
    if (cpfDigits.length !== 11 && cpfDigits.length !== 14) {
      return jsonResponse({ error: 'CPF ou CNPJ do cliente é obrigatório e precisa ser válido.' }, 400);
    }
    if (typeof planId !== 'string' || !PAID_PLANS.has(planId) || typeof method !== 'string' || !METHODS.has(method)) {
      return jsonResponse({ error: 'Plano e método de pagamento são obrigatórios.' }, 400);
    }
    if (method === 'cartao' && (!cardInfo?.number || !cardInfo.holderName || !cardInfo.ccv)) {
      return jsonResponse({ error: 'Dados do cartão incompletos.' }, 400);
    }
    const installmentCount = Math.min(12, Math.max(1, Number(installments) || 1));

    const { data: plan, error: planError } = await supabase
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      return jsonResponse({ error: 'Plano não encontrado.' }, 400);
    }

    // Buscar ou criar assinatura local
    const { data: existingSubscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('account_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      console.error('Checkout: erro ao buscar assinatura:', subError);
      return jsonResponse({ error: 'Erro ao buscar assinatura.' }, 500);
    }

    let subscription = existingSubscription;
    if (!subscription) {
      // Sem acesso até o pagamento ser confirmado pelo webhook
      const { data: newSub, error: createError } = await supabase
        .from('subscriptions')
        .insert([{ account_id: user.id, plan_id: planId, status: 'blocked' }])
        .select()
        .single();

      if (createError || !newSub) {
        console.error('Checkout: erro ao criar assinatura:', createError);
        return jsonResponse({ error: 'Erro ao criar assinatura no banco.' }, 500);
      }
      subscription = newSub;
    }

    // --- MODO SIMULAÇÃO (somente com ASAAS_MOCK=true e fora de produção) ---
    if (env.asaasMock) {
      console.log('Checkout em modo SIMULAÇÃO (ASAAS_MOCK=true).');

      if (method === 'pix') {
        const mockQrCode = '00020126580014br.gov.bcb.pix0136mock-pix-key-for-analista-financeiro-ia520400005303986540559.905802BR5913Analista IA6009Sao Paulo62070503***6304ABCD';
        return jsonResponse({
          success: true,
          method: 'pix',
          amount: plan.price_cents / 100,
          qrCode: mockQrCode,
          qrCodeImage: 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(mockQrCode),
          copiaECola: mockQrCode,
          subscriptionId: subscription.id,
          simulated: true,
        });
      }

      if (method === 'boleto') {
        return jsonResponse({
          success: true,
          method: 'boleto',
          amount: plan.price_cents / 100,
          barcode: '00190.00009 01234.567890 12345.678901 2 9876000000' + plan.price_cents,
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR'),
          subscriptionId: subscription.id,
          simulated: true,
        });
      }

      // Cartão: aprovação imediata simulada
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          plan_id: planId,
          trial_started_at: null,
          trial_ends_at: null,
          gateway: 'asaas_mock',
          gateway_subscription_id: 'sub_mock_' + crypto.randomUUID(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (updateError) {
        return jsonResponse({ error: 'Erro ao atualizar assinatura.' }, 500);
      }

      await supabase.from('payment_transactions').insert([{
        subscription_id: subscription.id,
        gateway_transaction_id: 'pay_mock_' + crypto.randomUUID(),
        method: 'cartao',
        installments: installmentCount,
        amount_cents: plan.price_cents,
        status: 'paid',
        paid_at: new Date().toISOString(),
      }]);

      return jsonResponse({
        success: true,
        method: 'cartao',
        message: 'Pagamento aprovado com sucesso! Plano ativo.',
        subscriptionId: subscription.id,
        simulated: true,
      });
    }

    if (!env.asaasApiKey) {
      console.error('Checkout: ASAAS_API_KEY não configurada.');
      return jsonResponse({ error: 'Pagamentos indisponíveis no momento. Tente novamente mais tarde.' }, 503);
    }

    // --- INTEGRAÇÃO REAL COM O ASAAS ---
    const headers = {
      'Content-Type': 'application/json',
      access_token: env.asaasApiKey,
    };

    // 1. Criar ou obter cliente no Asaas
    const customerPayload = {
      name: (user.user_metadata?.name as string | undefined) || 'Cliente Analista Financeiro',
      email: user.email,
      cpfCnpj: cpfDigits,
      externalReference: user.id,
    };

    const customerRes = await fetch(`${env.asaasBaseUrl}/customers?externalReference=${encodeURIComponent(user.id)}`, { headers });
    const customerData = customerRes.ok ? await customerRes.json() : null;
    let customerId: string | undefined = customerData?.data?.[0]?.id;

    if (!customerId) {
      const createCustRes = await fetch(`${env.asaasBaseUrl}/customers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(customerPayload),
      });
      const newCust = await createCustRes.json().catch(() => null);
      customerId = newCust?.id;
      if (!customerId) {
        console.error('Checkout: falha ao criar cliente no Asaas:', JSON.stringify(newCust?.errors ?? newCust));
        return jsonResponse({ error: newCust?.errors?.[0]?.description || 'Não foi possível cadastrar o cliente no gateway de pagamento.' }, 400);
      }
    } else {
      // Mantém nome e CPF/CNPJ sincronizados com o que foi informado agora
      await fetch(`${env.asaasBaseUrl}/customers/${customerId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ name: customerPayload.name, cpfCnpj: customerPayload.cpfCnpj }),
      });
    }

    // 2. Criar a assinatura recorrente no Asaas.
    // O plano escolhido vai no externalReference e só é aplicado pelo webhook
    // depois que o pagamento for confirmado.
    const asaasSubPayload: Record<string, unknown> = {
      customer: customerId,
      billingType: method === 'pix' ? 'PIX' : (method === 'boleto' ? 'BOLETO' : 'CREDIT_CARD'),
      value: plan.price_cents / 100,
      nextDueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 dias para pagar
      cycle: 'YEARLY',
      description: 'Assinatura ' + plan.name + ' - Analista Financeiro IA',
      externalReference: `${subscription.id}|${planId}`,
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
        cpfCnpj: cpfDigits,
        postalCode: cardInfo.postalCode,
        addressNumber: cardInfo.addressNumber,
        phone: cardInfo.phone || '11999999999',
      };
    }

    const subCreateRes = await fetch(`${env.asaasBaseUrl}/subscriptions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(asaasSubPayload),
    });
    const asaasSub = await subCreateRes.json().catch(() => null);

    if (!subCreateRes.ok || !asaasSub?.id || asaasSub.errors) {
      console.error('Checkout: erro ao criar assinatura no Asaas:', JSON.stringify(asaasSub?.errors ?? asaasSub));
      return jsonResponse({ error: asaasSub?.errors?.[0]?.description || 'Erro ao processar assinatura no gateway de pagamento.' }, 400);
    }

    // Só depois que a nova cobrança existe, cancela a anterior (troca de plano
    // ou nova tentativa) — sem isso as duas ficariam cobrando em paralelo.
    if (subscription.gateway_subscription_id && subscription.gateway === 'asaas') {
      try {
        await fetch(`${env.asaasBaseUrl}/subscriptions/${subscription.gateway_subscription_id}`, {
          method: 'DELETE',
          headers,
        });
      } catch (err) {
        console.error('Erro ao cancelar assinatura anterior no Asaas (seguindo mesmo assim):', err);
      }
    }

    // 3. Vincula a assinatura local ao ID do gateway (o plano só muda no webhook)
    await supabase
      .from('subscriptions')
      .update({
        gateway: 'asaas',
        gateway_subscription_id: asaasSub.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscription.id);

    // 4. Dados de pagamento imediato (QR Code Pix ou boleto)
    if (method === 'pix') {
      const payId = asaasSub.paymentId || (await getFirstPaymentId(asaasSub.id, headers));
      if (!payId) {
        return jsonResponse({
          error: 'A cobrança foi criada, mas o Asaas ainda não gerou os dados do Pix. Tente novamente em alguns segundos.',
        }, 202);
      }

      const pixRes = await fetch(`${env.asaasBaseUrl}/payments/${payId}/pixQrCode`, { headers });
      if (!pixRes.ok) {
        return jsonResponse({ error: 'Não foi possível gerar o QR Code Pix. Tente novamente.' }, 502);
      }
      const pixData = await pixRes.json();

      return jsonResponse({
        success: true,
        method: 'pix',
        amount: plan.price_cents / 100,
        qrCode: pixData.payload,
        qrCodeImage: 'data:image/png;base64,' + pixData.encodedImage,
        copiaECola: pixData.payload,
        subscriptionId: subscription.id,
      });
    }

    if (method === 'boleto') {
      const payId = asaasSub.paymentId || (await getFirstPaymentId(asaasSub.id, headers));
      if (!payId) {
        return jsonResponse({
          error: 'A cobrança foi criada, mas o Asaas ainda não gerou os dados do boleto. Tente novamente em alguns segundos.',
        }, 202);
      }

      const payRes = await fetch(`${env.asaasBaseUrl}/payments/${payId}`, { headers });
      if (!payRes.ok) {
        return jsonResponse({ error: 'Não foi possível obter os dados do boleto. Tente novamente.' }, 502);
      }
      const payData = await payRes.json();

      return jsonResponse({
        success: true,
        method: 'boleto',
        amount: plan.price_cents / 100,
        barcode: payData.identificationField,
        dueDate: payData.dueDate,
        bankSlipUrl: payData.bankSlipUrl,
        subscriptionId: subscription.id,
      });
    }

    // Cartão: a liberação acontece quando o webhook confirmar o pagamento
    return jsonResponse({
      success: true,
      method: 'cartao',
      message: 'Pagamento enviado. Seu plano será liberado assim que a operadora confirmar.',
      subscriptionId: subscription.id,
    });
  } catch (err) {
    console.error('Erro inesperado em /api/checkout:', err);
    return jsonResponse({ error: 'Erro interno no servidor.' }, 500);
  }
}
