// ==========================================
// SERVIÇO DE INTEGRAÇÃO — GEMINI API
// ==========================================
// O modelo e o system prompt completo vivem no backend (api/chat.ts),
// que roda como Vercel Function e usa GEMINI_API_KEY do servidor.
// Esse arquivo só cuida da comunicação entre o frontend e essa rota.
// ==========================================

import { supabase } from '../lib/supabase';
import type { Message, FinancialData } from '../types/financial';

// ──────────────────────────────────────────
// FUNÇÃO PRINCIPAL DE CHAT
// ──────────────────────────────────────────

export type ChatBlockReason = 'limit_reached' | 'expired' | 'blocked' | 'past_due_expired' | 'canceled';

export interface AIResponse {
  content: string;
  financialData: string | null;
  blocked?: boolean;
  blockReason?: ChatBlockReason | null;
  messagesRemainingToday?: number | null;
}

// Mesmo limite aplicado no backend; enviar menos reduz o tamanho da requisição.
const MAX_HISTORY_MESSAGES = 40;

export async function sendMessage(
  messages: Message[],
  financialData: FinancialData | null | undefined,
  profileId: string
): Promise<AIResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const recentMessages = messages
    .filter((m) => !m.isTyping && m.content.trim())
    .slice(-MAX_HISTORY_MESSAGES)
    .map(({ role, content }) => ({ role, content }));

  // Chamada exclusiva para a Rota de API Serverless do Vercel
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ messages: recentMessages, financialData, profileId }),
  });

  if (response.ok) {
    const data = await response.json();
    return data as AIResponse;
  } else {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido de servidor' }));
    throw new Error(errorData.error || `Erro HTTP ${response.status}`);
  }
}

/**
 * Mensagem de abertura padrão da IA
 */
export const OPENING_MESSAGE = `Olá! Sou seu **Analista Financeiro Pessoal**. Meu papel aqui é te ajudar a entender e te mostrar exatamente onde sua situação financeira está e o que precisa mudar. E juntos construirmos o melhor caminho para uma vida financeira saudável.

_Importante: sou uma ferramenta de organização e análise financeira, não um consultor de investimentos certificado nem um profissional de saúde mental. Para decisões de investimento específicas ou apoio emocional, recomendo sempre buscar um profissional qualificado._

Antes de começarmos, qual é o seu nome?`;
