// ==========================================
// CONTAGEM PÚBLICA DE PERFIS (BETA SLOTS)
// ==========================================
// Rota pública e segura: retorna a contagem total de vagas ocupadas
// no programa Beta a partir da tabela 'beta_seats', para exibição
// na landing page.
// Não expõe nenhum dado sensível — apenas números.
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
      return new Response(JSON.stringify({ count: null, limit: 50 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Consulta a tabela beta_seats para obter a contagem atômica real
    const response = await fetch(`${supabaseUrl}/rest/v1/beta_seats?id=eq.1&select=seats_taken,seats_limit`, {
      method: 'GET',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ count: null, limit: 50 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const count = data[0] ? parseInt(data[0].seats_taken, 10) : null;
    const limit = data[0] ? parseInt(data[0].seats_limit, 10) : 50;

    return new Response(JSON.stringify({ count, limit }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=10, stale-while-revalidate=5', // cache menor de 10s para evitar inconsistências durante cadastros simultâneos
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ count: null, limit: 50 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
