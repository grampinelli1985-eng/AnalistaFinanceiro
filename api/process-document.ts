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

export const maxDuration = 60;

declare const process: {
  env: {
    GEMINI_API_KEY?: string;
  };
};

const MODEL = 'gemini-pro';

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

export async function POST(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { mimeType, data, fileName } = await req.json();

    if (!mimeType || !data) {
      return new Response(JSON.stringify({ error: 'mimeType e data (base64) são obrigatórios' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (mimeType !== 'application/pdf') {
      return new Response(JSON.stringify({ error: 'Apenas arquivos PDF são aceitos nesta rota' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validação defensiva no servidor: ~5MB em base64 ≈ 6.7M caracteres
    if (typeof data === 'string' && data.length > 7_000_000) {
      return new Response(JSON.stringify({ error: 'Arquivo muito grande. O limite é de 5MB.' }), {
        status: 413,
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

    const apiMessages = [
      {
        role: "user",
        parts: [
          { text: `Leia e extraia os dados financeiros deste documento: ${fileName || 'documento.pdf'}` },
          { inline_data: { mime_type: mimeType, data } },
        ]
      }
    ];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: EXTRACTION_SYSTEM_PROMPT }]
        },
        contents: apiMessages,
        generationConfig: {
          temperature: 0.1, // mais baixa que o chat normal — extração precisa ser literal, não criativa
          maxOutputTokens: 4096,
        },
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

    const result = await response.json();
    const rawContent: string = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    function cleanJsonString(str: string): string {
      let cleaned = str.trim();
      cleaned = cleaned.replace(/```[a-zA-Z]*\n?/gi, '').replace(/```/g, '').trim();
      cleaned = cleaned.replace(/(?<!:)\/\/.*$/gm, '');
      cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
      cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
      return cleaned.trim();
    }

    let extractedData: string | null = null;
    const match = rawContent.match(/<extracted_data>([\s\S]*?)<\/extracted_data>/i);
    if (match) {
      try {
        const cleaned = cleanJsonString(match[1].trim());
        JSON.parse(cleaned); // valida que é JSON parseável
        extractedData = cleaned;
      } catch (e) {
        console.warn('Gemini retornou um bloco <extracted_data> com JSON inválido:', e);
        extractedData = null;
      }
    }

    // Remove o bloco JSON da mensagem visível — só o resumo em texto é mostrado ao usuário
    let summaryText = rawContent
      .replace(/<extracted_data>[\s\S]*?<\/extracted_data>/gi, '')
      .trim();
    if (/<extracted_data>/i.test(summaryText)) {
      summaryText = summaryText.replace(/<extracted_data>[\s\S]*/gi, '').trim();
    }

    return new Response(JSON.stringify({
      summary: summaryText || 'Documento processado, mas não foi possível gerar um resumo.',
      extractedData,
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
