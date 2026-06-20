// ==========================================
// CONTAGEM PÚBLICA DE PERFIS (BETA SLOTS)
// ==========================================
// Rota pública e segura: retorna SOMENTE a contagem total de perfis
// cadastrados no sistema, usada na landing page para mostrar a ocupação
// real do programa Beta (ex: "73 de 100 vagas preenchidas").
// Não expõe nenhum dado sensível — apenas um número.
// ==========================================

declare const process: {
  env: {
    VITE_SUPABASE_URL?: string;
    SUPABASE_SERVICE_ROLE_KEY?: string;
  };
};

export const maxDuration = 10;

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      // Falha de configuração não deve quebrar a landing page — retorna
      // null e o frontend simplesmente esconde o contador de vagas.
      return new Response(JSON.stringify({ count: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Usa a REST API do Supabase diretamente com a service role key
    // (necessária para fazer um count() sem estar autenticado como usuário).
    // O endpoint retorna apenas a contagem via header Content-Range,
    // sem nunca trafegar os dados das linhas em si.
    const response = await fetch(`${supabaseUrl}/rest/v1/profiles?select=id`, {
      method: 'HEAD',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'count=exact',
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ count: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const contentRange = response.headers.get('content-range') || '';
    // Formato esperado: "0-0/N" — extrai o N (total)
    const match = contentRange.match(/\/(\d+)$/);
    const count = match ? parseInt(match[1], 10) : null;

    return new Response(JSON.stringify({ count }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate=60', // cache de 5 min — não precisa ser em tempo real
      },
    });
  } catch (err) {
    // Qualquer erro aqui não deve quebrar a landing page
    return new Response(JSON.stringify({ count: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
