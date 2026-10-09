// ==========================================
// PROCESSAMENTO DEDICADO DE DOCUMENTOS (PDF)
// ==========================================
// Rota isolada do /api/chat. Recebe SOMENTE o PDF (sem histórico de
// conversa), extrai os dados financeiros relevantes uma única vez, e
// retorna um resumo em texto pronto para ser inserido no chat.
//
// Por quê isso é separado do /api/chat:
// O limite de payload de Vercel Functions é 4.5MB. Se o PDF (já pesado
// em base64) fosse enviado junto com o histórico de mensagens a cada
// chamada de chat, o payload cresceria a cada novo turno da conversa até
// ultrapassar esse limite (erro 413). Aqui, o PDF é processado uma única
// vez, descartado da memória após a extração, e só o TEXTO resultante
// (muito mais leve) entra no histórico do chat normal a partir daí.
// ==========================================

import {
  env,
  jsonResponse,
  getSupabaseAdmin,
  getAuthUser,
  readJsonBody,
  checkRateLimit,
  checkSubscriptionAccess,
  extractGeminiText,
  extractTaggedJson,
  BLOCK_MESSAGES,
} from './_lib/server.js';

export const maxDuration = 60;

// Limite de 4,5MB do corpo na Vercel: 3MB de PDF em base64 ≈ 4,2M caracteres
const MAX_BASE64_CHARS = 4_200_000;
const MAX_BODY_CHARS = MAX_BASE64_CHARS + 2_000;

const EXTRACTION_SYSTEM_PROMPT = `Você é um extrator de dados financeiros especializado em ler faturas de cartão de crédito e extratos bancários brasileiros em PDF.

Sua única tarefa é ler o documento anexado e retornar um RESUMO em texto claro do que você encontrou, seguido de um bloco JSON estruturado com os dados extraídos.

## REGRAS
1. Leia o documento e identifique: banco/instituição, nome do cartão (se houver), valor total da fatura/saldo, data de vencimento, e os principais lançamentos relevantes para classificação financeira (ex: identifique gastos recorrentes como "Netflix" → streaming, "Posto Shell" → combustível).
2. Se o documento for uma FATURA DE CARTÃO: mapeie o valor total da fatura como uma dívida do tipo "credit_card" — "monthlyPayment" recebe o valor da fatura atual, e "totalAmount" recebe o saldo total/rotativo se identificável (caso contrário, repita o valor da fatura).
3. Se o documento for um EXTRATO BANCÁRIO: NÃO tente classificar cada lançamento individualmente. Resuma os padrões principais que você identificar (ex: "vi recorrência de débitos de água, luz e um financiamento") como uma observação em texto, sem preencher valores específicos nas categorias — isso será confirmado com o usuário depois.
4. Categorize gastos identificados quando possível em: despesas fixas (aluguel, água, luz, gás, internet, telefone, streaming, assinaturas, seguros, educação), despesas variáveis (alimentação, restaurantes, transporte, lazer, pets, cuidados pessoais), ou gastos sazonais (IPVA, manutenção anual de veículo — use o array "seasonalExpenses" com "annualAmount" e "monthDue").
5. NUNCA invente valores que não conseguir ler claramente no documento. Se uma informação estiver ilegível ou ausente, simplesmente não a inclua no JSON (deixe o campo como 0 ou omita o item da lista).
6. NUNCA inclua na resposta renda (PLR, salário, 13º) mesmo que apareça no documento — essa rota processa apenas DESPESAS e DÍVIDAS. Se identificar valores de entrada, mencione isso no texto mas não os inclua no JSON de despesas.
7. Se o PDF não for legível, estiver corrompido, ou não parecer ser um documento financeiro, retorne um resumo em texto explicando isso, e o bloco JSON com todos os campos zerados/vazios.

## FORMATO DE RESPOSTA
Primeiro, um resumo em texto curto e claro do que foi encontrado (2-5 frases, citando valores concretos). Depois, o bloco JSON parcial (apenas os campos que você conseguiu identificar — os demais ficam com valor 0 ou array vazio):

<extracted_data>
{
  "fixedExpenses": {
    "rent": 0, "vehicleLoan": 0, "healthPlan": 0, "internet": 0, "phone": 0,
    "streaming": 0, "subscriptions": 0, "water": 0, "electricity": 0, "gas": 0,
    "carInsurance": 0, "homeInsurance": 0, "education": 0, "other": 0
  },
  "variableExpenses": {
    "food": 0, "restaurants": 0, "transport": 0, "leisure": 0, "shopping": 0,
    "health": 0, "pets": 0, "personalCare": 0, "other": 0
  },
  "seasonalExpenses": [],
  "debts": [
    {
      "id": "debt-doc-1",
      "name": "Nome do banco/cartão identificado",
      "type": "credit_card",
      "totalAmount": 0,
      "monthlyPayment": 0,
      "monthlyInterestRate": 0,
      "remainingMonths": 0
    }
  ]
}
</extracted_data>

IMPORTANTE: o resumo em texto SEMPRE vem antes da tag <extracted_data>. Nunca omita o texto e envie só o JSON.`;

interface ProcessDocumentBody {
  mimeType?: unknown;
  data?: unknown;
  fileName?: unknown;
}

/** Todo PDF começa com "%PDF-", que em base64 é "JVBERi0". */
export function looksLikePdfBase64(data: string): boolean {
  return data.startsWith('JVBERi0');
}

export async function POST(req: Request): Promise<Response> {
  try {
    const supabase = getSupabaseAdmin();
    if (!env.geminiApiKey || !supabase) {
      console.error('Variáveis de ambiente ausentes: GEMINI_API_KEY e/ou SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.');
      return jsonResponse({ error: 'Servidor não configurado corretamente.' }, 500);
    }

    const user = await getAuthUser(req);
    if (!user) {
      return jsonResponse({ error: 'Sessão expirada ou inválida. Faça login novamente.' }, 401);
    }

    const parsed = await readJsonBody<ProcessDocumentBody>(req, MAX_BODY_CHARS);
    if ('error' in parsed) {
      return parsed.error.status === 413
        ? jsonResponse({ error: 'Arquivo muito grande. O limite é de 3MB.' }, 413)
        : parsed.error;
    }
    const { mimeType, data, fileName } = parsed.body;

    if (mimeType !== 'application/pdf' || typeof data !== 'string' || !data) {
      return jsonResponse({ error: 'Apenas arquivos PDF são aceitos nesta rota' }, 400);
    }
    if (data.length > MAX_BASE64_CHARS) {
      return jsonResponse({ error: 'Arquivo muito grande. O limite é de 3MB.' }, 413);
    }
    if (!looksLikePdfBase64(data)) {
      return jsonResponse({ error: 'O arquivo enviado não parece ser um PDF válido.' }, 400);
    }

    if (!(await checkRateLimit(supabase, user.id))) {
      return jsonResponse({ error: 'Muitas requisições em pouco tempo. Aguarde um pouco e tente novamente.' }, 429);
    }

    const access = await checkSubscriptionAccess(supabase, user.id);
    if ('reason' in access) {
      return jsonResponse({ error: BLOCK_MESSAGES[access.reason] }, 403);
    }

    const safeFileName = typeof fileName === 'string' ? fileName.slice(0, 200) : 'documento.pdf';

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.geminiModel}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.geminiApiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: EXTRACTION_SYSTEM_PROMPT }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: `Leia e extraia os dados financeiros deste documento: ${safeFileName}` },
              { inline_data: { mime_type: 'application/pdf', data } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1, // mais baixa que o chat normal — extração precisa ser literal, não criativa
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error(`Gemini respondeu ${response.status} ao processar documento:`, errorBody.slice(0, 2000));
      const status = response.status === 429 ? 503 : 502;
      return jsonResponse({ error: 'Não foi possível processar o documento agora. Tente novamente em alguns instantes.' }, status);
    }

    const result = await response.json();
    const { visibleText, json: extractedData } = extractTaggedJson(extractGeminiText(result), 'extracted_data');

    return jsonResponse({
      summary: visibleText || 'Documento processado, mas não foi possível gerar um resumo.',
      extractedData,
    });
  } catch (err) {
    console.error('Erro inesperado em /api/process-document:', err);
    return jsonResponse({ error: 'Erro interno do servidor.' }, 500);
  }
}
