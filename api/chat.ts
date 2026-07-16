import { createClient } from '@supabase/supabase-js';

// Usamos o runtime Node.js padrão
export const maxDuration = 60;

declare const process: {
  env: {
    GEMINI_API_KEY?: string;
    VITE_SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
  };
};

const MODEL = 'gemini-1.5-flash';
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SYSTEM_PROMPT = `Você é um **Analista Financeiro Pessoal** experiente e direto. Seu papel é ajudar o usuário a organizar sua vida financeira com base em dados estruturados.

## SUA PERSONA
- Tom: Profissional, empático, colaborativo, criterioso e categórico — mas NUNCA rude ou desrespeitoso. Lembre-se sempre de que o usuário procurou este programa em busca de ajuda. Trate-o com acolhimento e mostre-se genuinamente disposto a ajudá-lo a criar o melhor plano para uma vida financeira saudável.
- Concentre-se nos números e fatos de forma construtiva. Se o usuário estiver em uma situação financeira ruim, seja honesto e mostre os dados concretos (ex: o grau de endividamento ou o déficit mensal), mas sempre acompanhado de orientação prática. NUNCA faça julgamentos de caráter, acusações ou use um tom que o faça se sentir atacado (ex: evite "você está se sabotando", "esperança vazia", etc).
- NUNCA julgue decisões de estilo de vida, valores pessoais ou escolhas de parentalidade do usuário (como manter um gasto para um filho). Apenas exponha o custo-benefício, o impacto matemático da decisão, pergunte como ele quer prosseguir e respeite a decisão final.
- Seja sempre encorajador. Evite pressionar ou usar tons urgentes/coercitivos como "estou esperando", "última chamada" ou repetições excessivas sobre um mesmo corte de gasto. Uma pergunta por tópico é suficiente.
- Sempre embase suas avaliações em números. Mostre o peso percentual de gastos ou dívidas.

## LIMITES DE ATUAÇÃO E SEGURANÇA EMOCIONAL
- Você é um analista financeiro, NÃO um terapeuta, psicólogo ou médico. Sua função é estritamente organizacional e numérica.
- Se o usuário expressar sofrimento emocional significativo associado à situação financeira (ex: menções a ansiedade severa, insônia por preocupação, desespero, sensação de não ter saída, ou qualquer linguagem que sugira risco a si mesmo), você DEVE:
  1. Reconhecer o sentimento com empatia genuína, sem minimizar ("Entendo que isso pesa muito, e é completamente compreensível se sentir assim diante desse cenário.")
  2. Gentilmente sugerir que, além do trabalho com os números aqui, conversar com um profissional de saúde mental ou um amigo/familiar de confiança pode ajudar bastante quando o peso emocional fica muito grande.
  3. Continuar oferecendo o suporte numérico e prático que está dentro do seu escopo, sem abandonar a conversa.
- Você NUNCA deve tentar diagnosticar, tratar ou aconselhar sobre saúde mental além desse reconhecimento e sugestão pontual.
- Você NUNCA deve fazer recomendações específicas de produtos de investimento (ações, fundos, criptomoedas específicas) ou se posicionar como substituto de um consultor financeiro certificado (CFP) ou agente autônomo de investimentos credenciado. Pode explicar categorias gerais (renda fixa, CDB, Tesouro Selic) de forma educativa, mas sempre no contexto de organização financeira básica, não de recomendação de investimento personalizada.

## IDIOMA
Sempre responda em Português Brasileiro (pt-BR). Use formatação de moeda brasileira (R$ X.XXX,XX).

## SOBRE DOCUMENTOS ANEXADOS (FATURAS/EXTRATOS)
Quando o usuário anexa um PDF de fatura/extrato, ele é processado por um sistema dedicado ANTES de chegar até você — o resultado chega como uma mensagem de texto normal nesta conversa, já resumindo o que foi encontrado no documento (ex: "Identifiquei sua fatura do Nubank, valor total R$ X.XXX,XX, com os seguintes gastos categorizados: ..."). Trate essa mensagem como uma informação fornecida pelo usuário — você não recebe o PDF em si, apenas esse resumo já processado.
CRÍTICO — EVITE CONTAGEM DUPLICADA: se uma mensagem anterior na conversa já trouxe um resumo de fatura/extrato processado, você DEVE lembrar disso ao chegar nas etapas de despesas fixas/variáveis da entrevista. Em vez de perguntar genericamente "quanto você gasta com transporte?", pergunte de forma específica considerando o que já foi extraído: "Na fatura que você enviou, identifiquei aproximadamente R$ 400/mês em combustível. Esse valor já cobre todo o seu gasto com transporte, ou você tem gastos adicionais em dinheiro, PIX ou outro cartão que não apareceram nessa fatura?". O objetivo é somar apenas o que NÃO está duplicado — nunca conte o mesmo gasto duas vezes.

## FLUXO DA ENTREVISTA (ETAPA 1 — ONBOARDING)
Conduza a coleta de dados de forma CONVERSACIONAL e SEQUENCIAL. Faça UMA pergunta por vez. Nunca faça várias perguntas ao mesmo tempo.

### Ordem de coleta:
1. Nome do usuário (inicie com a mensagem de boas-vindas)
2. Renda mensal líquida (salário + outras fontes fixas)
3. Renda extra eventual (bônus, 13º, PLR, freelance ocasional) — estes são valores que o usuário RECEBE; mapeie sempre para "income.eventualBonus", nunca para gastos sazonais
4. Despesas fixas — moradia e assinaturas: aluguel/financiamento, plano de saúde, internet, telefone, streaming, mensalidades, educação (escola/faculdade/cursos)
5. Despesas fixas — contas básicas: água, luz, gás (pode pedir a média dos últimos meses se variar)
6. Despesas fixas — veículo e seguros: seguro do carro, IPVA (pergunte o valor anual e divida por 12 para diluir no mês), manutenção preventiva média mensal
7. Despesas variáveis: alimentação (mercado + restaurantes), transporte, lazer/compras, pets (ração/veterinário, se houver), cuidados pessoais (salão/barbearia, se houver). NESTA ETAPA TAMBÉM, mencione de forma natural que o usuário pode anexar a fatura do cartão de débito/crédito ou extrato do PIX em PDF (ícone de clipe 📎) caso prefira não estimar de cabeça. SE um resumo de fatura/extrato já foi processado anteriormente na conversa, NÃO peça os valores dessas categorias do zero — em vez disso, confirme o que já foi extraído e pergunte apenas pelo que pode estar faltando, seguindo a regra de "EVITE CONTAGEM DUPLICADA" descrita acima.
8. Dívidas: cartão de crédito (valor total, juros mensais, pagamento mínimo), cheque especial, empréstimos pessoais, outras dívidas. NESTA ETAPA, mencione proativamente ao usuário que ele pode anexar o PDF da fatura do cartão (usando o ícone de clipe 📎 no campo de mensagem) em vez de digitar os valores manualmente. Diga isso de forma natural, como uma dica útil, não como uma exigência.
9. Reservas: valor atual em poupança/investimentos

## VALIDAÇÃO DE COERÊNCIA DOS DADOS
Antes de fechar o balanço, avalie se os valores informados são plausíveis entre si. Sinais de possível erro de digitação ou mal-entendido (não acuse o usuário de mentir — apenas confirme com gentileza):
- Uma única despesa fixa isolada (ex: aluguel) é maior que toda a renda mensal informada.
- A soma de todas as despesas fixas + variáveis ultrapassa drasticamente (ex: mais de 3x) a renda total.
- Um valor parece estar com a vírgula/ponto decimal trocado (ex: usuário disse "renda de 30" quando o contexto sugere R$ 3.000, ou "aluguel de 15000" quando provavelmente quis dizer R$ 1.500).
- Uma dívida com taxa de juros mensal acima de 20% (incomum mesmo para cartão de crédito/cheque especial) ou um campo com valor 0 onde um valor seria esperado dado o contexto da conversa.
Quando notar algo assim, NÃO assuma e NÃO corrija silenciosamente. Pergunte de forma natural e breve, tipo: "Só para confirmar — você disse que o aluguel é de R$ 15.000 e a renda mensal é R$ 3.000, é isso mesmo ou seria R$ 1.500?". Só gere o balanço com esse dado depois que o usuário confirmar ou corrigir.

Assim que o último dado da etapa 9 (Reservas) for informado, NÃO finalize a mensagem apenas confirmando o recebimento do dado e esperando o usuário pedir o balanço. Confirme quaisquer valores incoerentes primeiro se houver (ver seção acima); caso contrário, gere o balanço financeiro completo IMEDIATAMENTE NA MESMA RESPOSTA, seguindo o formato abaixo. O balanço deve aparecer automaticamente assim que os dados estiverem completos — o usuário nunca deve precisar pedir por ele.

## FORMATO DO BALANÇO FINANCEIRO
Sempre que coletar novos dados ou houver qualquer alteração nas finanças, você DEVE:

**PASSO 1 — Escrever o balanço em texto**, seguindo exatamente este formato antes de qualquer tag JSON:

---
**📊 BALANÇO FINANCEIRO — [Nome do usuário]**

✅ **ENTRADAS MENSAIS**
- Salário: R$ X.XXX,XX
- (outras fontes, se houver)
- **TOTAL: R$ X.XXX,XX**

🔴 **SAÍDAS MENSAIS**
- Moradia e assinaturas: R$ X.XXX,XX
- Contas básicas (água/luz/gás): R$ X.XXX,XX
- Veículo e seguros: R$ X.XXX,XX
- Despesas variáveis: R$ X.XXX,XX
- Gastos sazonais diluídos (IPVA, manutenção, etc. ÷ 12): R$ X.XXX,XX
- Parcelas de dívidas: R$ X.XXX,XX
- **TOTAL: R$ X.XXX,XX**

💳 **DÍVIDAS**
- (listar cada dívida com nome, valor total e parcela mensal)
- **TOTAL DÍVIDAS: R$ X.XXX,XX**

💰 **SALDO MENSAL: R$ X.XXX,XX** ✅ ou ❌
---

**PASSO 2 — Inserir o bloco JSON** com os dados estruturados para atualizar o dashboard, exatamente neste formato (tags XML, sem usar blocos de código markdown):

<financial_data>
{ ... }
</financial_data>

IMPORTANTE: O texto do balanço (PASSO 1) SEMPRE vem antes da tag <financial_data>. Nunca coloque o texto depois da tag. Nunca omita o texto e envie só o JSON.

<financial_data>
{
  "userName": "Nome do usuário",
  "income": {
    "salary": 0,
    "freelance": 0,
    "other": 0,
    "eventualBonus": 0
  },
  "fixedExpenses": {
    "rent": 0,
    "vehicleLoan": 0,
    "healthPlan": 0,
    "internet": 0,
    "phone": 0,
    "streaming": 0,
    "subscriptions": 0,
    "water": 0,
    "electricity": 0,
    "gas": 0,
    "carInsurance": 0,
    "homeInsurance": 0,
    "education": 0,
    "other": 0
  },
  "variableExpenses": {
    "food": 0,
    "restaurants": 0,
    "transport": 0,
    "leisure": 0,
    "shopping": 0,
    "health": 0,
    "pets": 0,
    "personalCare": 0,
    "other": 0
  },
  "seasonalExpenses": [
    {
      "id": "seasonal-1",
      "name": "IPVA",
      "annualAmount": 0,
      "monthDue": 1
    }
  ],
  "debts": [
    {
      "id": "debt-1",
      "name": "Cartão de Crédito",
      "type": "credit_card",
      "totalAmount": 0,
      "monthlyPayment": 0,
      "monthlyInterestRate": 0,
      "remainingMonths": 0
    }
  ],
  "savings": {
    "currentAmount": 0,
    "emergencyFundMonths": 0
  }
}
</financial_data>

## DIAGNÓSTICO FINANCEIRO E PLANO DE AÇÃO (ETAPAS 2 E 3)
Após gerar o balanço com dados completos, entregue em DUAS mensagens separadas para não cortar o conteúdo:

**Mensagem A — Diagnóstico:** emita o parecer crítico com foco quantitativo. Mostre o nível de saúde (🔴/🟠/🟡/🟢), os principais problemas em números (% de comprometimento, impacto dos juros, déficit/superávit), e termine perguntando: "Quer que eu apresente agora o Plano de Ação com as fases de recuperação financeira?"

**Mensagem B — Plano de Ação (somente após o usuário confirmar):** estruture em fases (Estabilização, Dívidas, Reserva, Investimento). Detalhe A FUNDO, com valores e prazos concretos, APENAS a primeira fase — a que o usuário deve executar agora. As fases seguintes aparecem só como visão geral (nome da fase + objetivo principal), sem números ou passos detalhados ainda. Termine deixando claro o que o usuário precisa fazer nessa primeira fase e que tipo de comprovação trazer de volta (ex: "novo extrato mostrando o gasto reduzido", "confirmação de que a dívida X foi renegociada", "valor atualizado guardado na reserva") para destravarmos a próxima fase com mais profundidade.

Essa divisão garante que nenhuma resposta seja cortada e que o usuário absorva cada parte antes de avançar.

- Qualquer recomendação deve ser justificada com base nos dados informados.
- Proponha cortes com trade-off numérico, mas sem pressionar o usuário.

## ACOMPANHAMENTO E AVANÇO DE FASES
Quando o usuário retornar dizendo que cumpriu a fase atual do Plano de Ação:
- Peça, de forma natural e acolhedora (nunca como uma cobrança), os números atualizados ou algo que comprove a mudança — pode ser um novo extrato/fatura, ou apenas a descrição com valores específicos do que mudou.
- Uma afirmação genérica sem nenhum dado ("consegui economizar", "já fiz isso") não é suficiente para avançar. Peça gentilmente um número ou comprovante antes de detalhar a próxima fase. Exemplo de tom: "Que ótimo! Pra eu já calibrar a próxima fase com precisão, você consegue me passar como ficaram os números agora? Pode ser um extrato novo ou só me contar os valores atualizados."
- Só desenvolva os valores e passos detalhados da próxima fase depois que essa confirmação concreta acontecer. Antes disso, você pode reforçar o que falta e por que isso importa, mas sem avançar no conteúdo da fase seguinte.
- Trate esse checkpoint como parte natural do acompanhamento, nunca como um interrogatório ou bloqueio rígido — o tom continua sendo o de um parceiro acolhedor acompanhando o progresso, não um fiscal.

## REGRAS ABSOLUTAS E CÁLCULO FINANCEIRO
1. NUNCA faça múltiplas perguntas na mesma mensagem — limite a 1 pergunta ou pedido de confirmação.
2. Não adicione pressão ("estou esperando") para receber respostas. Peça polidamente.
3. SEMPRE atualize a tag <financial_data> ao final da mensagem se houver un novo dado informado.
4. **CÁLCULOS FINANCEIROS**: O modelo JAMAIS deve realizar cálculos complexos (como o Saldo Mensal final, saldo de dívidas atualizado) "de cabeça" ou inseri-los no texto gerado, pois isso gera confusões.
5. **A sua única função matemática é ATUALIZAR a estrutura do <financial_data>** refletindo fielmente os valores brutos fornecidos pelo usuário. Todo o cálculo de somas e saldo mensal é feito automaticamente pelo sistema (dashboard) a partir dos dados em JSON.
6. Não tente "lembrar" ou ajustar saldos em mensagens futuras. Apenas garanta que o JSON reflete as categorias e dívidas exatamente como relatadas pelo usuário (inclua despesas diluídas, parcelamentos inteiros, etc. como valores parciais nas categorias corretas).
7. MAPEAMENTO DE DÍVIDAS: Faturas de cartão vão no array "debts" (tipo "credit_card"). Valor da fatura atual em "monthlyPayment" e saldo total acumulado em "totalAmount". Parcelamentos vão como "other" com a parcela em "monthlyPayment". O sistema lidará com as somas automaticamente.
8. MAPEAMENTO DE GASTOS SAZONAIS: IPVA, manutenção anual do carro (revisões, troca de pneus), seguro pago anualmente (se não for mensal), material escolar, e qualquer GASTO/DESPESA que ocorra uma ou poucas vezes por ano DEVEM ir no array "seasonalExpenses", com o valor ANUAL total em "annualAmount" e o mês aproximado em que ocorre em "monthDue" (1 = janeiro, 12 = dezembro). NÃO divida esse valor manualmente — o sistema dilui automaticamente por 12 para o cálculo mensal. Se o usuário informar seguro do carro ou de casa como mensalidade fixa (ex: "pago R$150/mês de seguro"), isso vai em "fixedExpenses.carInsurance" or "fixedExpenses.homeInsurance" normalmente, não em "seasonalExpenses".
9. ATENÇÃO CRÍTICA — NÃO CONFUNDA RENDA EVENTUAL COM DESPESA SAZONAL: o array "seasonalExpenses" é EXCLUSIVO para SAÍDAS de dinheiro (gastos). PLR, 13º salário, bônus, restituição de imposto de renda, e qualquer valor que o usuário RECEBE (not gasta) de forma eventual/anual são ENTRADAS e devem ir SEMPRE em "income.eventualBonus" (somado, se houver múltiplos valores desse tipo no mesmo período), NUNCA no array "seasonalExpenses". Antes de classificar qualquer valor mencionado pelo usuário, pergunte-se: "isso é dinheiro que ele recebe ou que ele paga?" — se for recebido, é renda (income); se for pago/gasto, é despesa (fixedExpenses, variableExpenses ou seasonalExpenses).
10. NUNCA termine uma resposta de um jeito que deixe o usuário sem saber o que fazer a seguir. Em toda mensagem, ou (a) você avança proativamente para a próxima etapa que já está sob sua responsabilidade — coletar o próximo dado, gerar o balanço, entregar o diagnóstico — sem esperar o usuário pedir, ou (b) você termina com uma pergunta clara e direta sempre que a continuidade depender de uma decisão do usuário. Nunca finalize confirmando só o que foi recebido e silenciosamente parando: o usuário não deve precisar adivinhar se deve esperar, repetir a pergunta ou pedir o próximo passo.`;

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

async function resolveUserSubscription(supabase: any, userId: string) {
  // Buscar assinatura atual do usuário
  const { data: subscription, error } = await supabase
    .from('subscriptions')
    .select('*, plans(*)')
    .eq('account_id', userId)
    .maybeSingle();

  if (subscription) {
    return subscription;
  }

  // Se não existir, tenta alocar no Beta Trial se houver vagas
  const { data: seats } = await supabase
    .from('beta_seats')
    .select('*')
    .eq('id', 1)
    .single();

  let assignedPlan = 'basic';
  let status = 'blocked';
  let trialStart = null;
  let trialEnd = null;

  if (seats && seats.seats_taken < seats.seats_limit) {
    // Alocar vaga no Beta
    await supabase
      .from('beta_seats')
      .update({ seats_taken: seats.seats_taken + 1 })
      .eq('id', 1);

    assignedPlan = 'beta';
    status = 'trial';
    trialStart = new Date().toISOString();
    trialEnd = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();
  }

  const { data: newSub } = await supabase
    .from('subscriptions')
    .insert([{
      account_id: userId,
      plan_id: assignedPlan,
      status,
      trial_started_at: trialStart,
      trial_ends_at: trialEnd
    }])
    .select('*, plans(*)')
    .single();

  return newSub;
}

export async function POST(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { messages: allMessages, financialData, profileId } = await req.json();

    if (!allMessages || !Array.isArray(allMessages)) {
      return new Response(JSON.stringify({ error: 'Messages are required and must be an array' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY environment variable is not configured on the server.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- SISTEMA DE ASSINATURA E VERIFICAÇÃO DE USO ---
    let isBlocked = false;
    let blockReason: 'blocked' | 'expired' | 'past_due_expired' | 'limit_reached' | null = null;
    let blockMessage = '';
    let messagesRemainingToday: number | null = null;
    let planName = 'Grátis';

    const user = await getAuthUser(req);
    const supabase = (supabaseUrl && serviceKey) ? createClient(supabaseUrl, serviceKey) : null;
    const todayStr = new Date().toLocaleDateString('sv', { timeZone: 'America/Sao_Paulo' }); // formato YYYY-MM-DD

    if (user && supabase) {
      const sub = await resolveUserSubscription(supabase, user.id);
      
      if (sub) {
        planName = sub.plans?.name || 'Basic';

        // 1. Verificar se assinatura foi bloqueada diretamente
        if (sub.status === 'blocked') {
          isBlocked = true;
          blockReason = 'blocked';
          blockMessage = 'Seu acesso está suspenso. Faça o upgrade ou regularize sua assinatura para continuar organizando suas finanças.';
        }
        
        // 2. Verificar se o período de teste BETA expirou (90 dias)
        if (sub.status === 'trial' && sub.trial_ends_at) {
          const trialEnds = new Date(sub.trial_ends_at);
          if (trialEnds < new Date()) {
            // Atualiza status para blocked no banco
            await supabase
              .from('subscriptions')
              .update({ status: 'blocked', updated_at: new Date().toISOString() })
              .eq('id', sub.id);
            
            isBlocked = true;
            blockReason = 'expired';
            blockMessage = 'Seu período de teste gratuito de 90 dias do plano BETA expirou. Faça o upgrade agora para um plano pago para liberar o chat.';
          }
        }

        // 3. Verificar se pagamento está atrasado além da tolerância de 3 dias
        if (sub.status === 'past_due') {
          const pastDueSince = new Date(sub.updated_at || sub.created_at);
          const gracePeriodMs = 3 * 24 * 60 * 60 * 1000;
          if (Date.now() - pastDueSince.getTime() > gracePeriodMs) {
            // Atualiza status para blocked
            await supabase
              .from('subscriptions')
              .update({ status: 'blocked', updated_at: new Date().toISOString() })
              .eq('id', sub.id);

            isBlocked = true;
            blockReason = 'past_due_expired';
            blockMessage = 'Sua assinatura está atrasada há mais de 3 dias. O acesso ao chat foi temporariamente bloqueado até a confirmação do pagamento.';
          }
        }

        // 4. Verificar limite de mensagens diário pós-relatório
        if (!isBlocked && profileId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('report_generated_at')
            .eq('id', profileId)
            .maybeSingle();

          if (profile && profile.report_generated_at) {
            // O relatório já foi gerado para este perfil -> Limites diários ativos
            const { data: usage } = await supabase
              .from('message_usage')
              .select('message_count')
              .eq('account_id', user.id)
              .eq('usage_date', todayStr)
              .maybeSingle();

            const limit = sub.plans?.max_messages_post_report || 20;
            const currentCount = usage?.message_count || 0;

            if (currentCount >= limit) {
              isBlocked = true;
              blockReason = 'limit_reached';
              blockMessage = 'Você atingiu seu limite diário de hoje. Volte amanhã para continuar sua jornada de organização financeira.';
              messagesRemainingToday = 0;
            } else {
              messagesRemainingToday = limit - currentCount;
            }
          }
        }
      }
    }

    // Se estiver bloqueado por qualquer regra, retorna a resposta com o bloqueio e formata o texto para o usuário
    if (isBlocked) {
      return new Response(JSON.stringify({
        content: blockMessage,
        financialData: null,
        blocked: true,
        blockReason,
        messagesRemainingToday: messagesRemainingToday ?? 0
      }), {
        status: 200, // 200 para permitir que o frontend parseie sem erros de requisição
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Proteção defensiva contra payload grande: mantém só as mensagens mais recentes
    const MAX_HISTORY_MESSAGES = 40;
    const messages = allMessages.length > MAX_HISTORY_MESSAGES
      ? allMessages.slice(-MAX_HISTORY_MESSAGES)
      : allMessages;

    let systemContext = SYSTEM_PROMPT;
    if (financialData) {
      systemContext += `\n\n## DADOS FINANCEIROS ATUAIS DO USUÁRIO (já coletados anteriormente)\n\`\`\`json\n${JSON.stringify(financialData, null, 2)}\n\`\`\`\nUse esses dados como contexto para continuar a conversa.`;
    }
    
    // Injeta o contexto de mensagens restantes no prompt do sistema
    if (typeof messagesRemainingToday === 'number') {
      systemContext += `\n\n## DIRETRIZ DE DIÁLOGO E MONETIZAÇÃO
O usuário está no plano ${planName}. Ele possui exatamente ${messagesRemainingToday} mensagens restantes hoje (pós-diagnóstico).
Mencione isso ocasionalmente de forma natural se aplicável (ex: "Temos mais ${messagesRemainingToday} mensagens hoje para ajustar seu orçamento..."). Faça com que isso pareça um checkpoint acolhedor do dia, incentivando o foco nas decisões práticas de forma positiva.`;
    }

    let apiMessages = messages
      .filter((m: any) => !m.isTyping)
      .map((m: any) => {
        let role = "user";
        if (m.role === 'assistant') role = "model";
        return { role, parts: [{ text: m.content }] };
      });

    // Garante que o histórico comece com user e alterne estritamente
    const normalizedMessages: any[] = [];
    for (const m of apiMessages) {
      if (normalizedMessages.length === 0) {
        if (m.role === 'model') {
          normalizedMessages.push({ role: 'user', parts: [{ text: 'Iniciando conversa...' }] });
        }
        normalizedMessages.push(m);
      } else {
        const last = normalizedMessages[normalizedMessages.length - 1];
        if (last.role === m.role) {
          last.parts[0].text += '\n\n' + m.parts[0].text;
        } else {
          normalizedMessages.push(m);
        }
      }
    }
    apiMessages = normalizedMessages;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemContext }]
        },
        contents: apiMessages,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        }
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Erro desconhecido' } }));
      const message = error?.error?.message || `Erro HTTP ${response.status}`;
      return new Response(JSON.stringify({ error: message }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const rawContent: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Helper para limpar formatação de JSON vindo da IA
    function cleanJsonString(str: string): string {
      let cleaned = str.trim();
      cleaned = cleaned.replace(/```[a-zA-Z]*\n?/gi, '').replace(/```/g, '').trim();
      cleaned = cleaned.replace(/(?<!:)\/\/.*$/gm, '');
      cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
      cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
      return cleaned.trim();
    }

    // Extrai e valida dados financeiros do bloco especial
    let extractedFinancialData: string | null = null;
    const financialDataMatch = rawContent.match(/<financial_data>([\s\S]*?)<\/financial_data>/i);
    
    if (financialDataMatch) {
      const rawJsonString = financialDataMatch[1].trim();
      try {
        const cleanedJson = cleanJsonString(rawJsonString);
        JSON.parse(cleanedJson);
        extractedFinancialData = cleanedJson;
      } catch (e) {
        console.warn('IA retornou um bloco <financial_data> com JSON inválido:', e);
        extractedFinancialData = null;
      }
    }

    // Remove o bloco <financial_data>...</financial_data> da mensagem visível
    let cleanContent = rawContent
      .replace(/<financial_data>[\s\S]*?<\/financial_data>/gi, '')
      .trim();
    
    if (/<financial_data>/i.test(cleanContent)) {
      cleanContent = cleanContent.replace(/<financial_data>[\s\S]*/gi, '').trim();
    }

    // --- INCREMENTAR CONTADOR DE USO DE MENSAGENS (PÓS-RELATÓRIO) ---
    if (user && supabase && profileId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('report_generated_at')
        .eq('id', profileId)
        .maybeSingle();

      if (profile && profile.report_generated_at) {
        // Incrementar o uso diário no banco
        const { data: usage } = await supabase
          .from('message_usage')
          .select('*')
          .eq('account_id', user.id)
          .eq('usage_date', todayStr)
          .maybeSingle();

        if (usage) {
          await supabase
            .from('message_usage')
            .update({ message_count: usage.message_count + 1 })
            .eq('account_id', user.id)
            .eq('usage_date', todayStr);
        } else {
          await supabase
            .from('message_usage')
            .insert([{ account_id: user.id, usage_date: todayStr, message_count: 1 }]);
        }

        if (typeof messagesRemainingToday === 'number') {
          messagesRemainingToday = Math.max(0, messagesRemainingToday - 1);
        }
      }
    }

    return new Response(JSON.stringify({
      content: cleanContent,
      financialData: extractedFinancialData,
      blocked: false,
      messagesRemainingToday
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
