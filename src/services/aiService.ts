// ==========================================
// SERVIÇO DE INTEGRAÇÃO — GEMINI API
// ==========================================
// O modelo e o system prompt completo vivem no backend (api/chat.ts),
// que roda como Edge Function no Vercel e usa GEMINI_API_KEY do servidor.
// Esse arquivo só cuida da comunicação entre o frontend e essa rota.
// ==========================================

import { supabase } from '../lib/supabase';
import type { Message, FinancialData } from '../types/financial';

// ──────────────────────────────────────────
// FUNÇÃO PRINCIPAL DE CHAT
// ──────────────────────────────────────────

export interface AIResponse {
  content: string;
  financialData: string | null;
  blocked?: boolean;
  blockReason?: 'limit_reached' | 'expired' | 'blocked' | 'past_due_expired' | null;
  messagesRemainingToday?: number | null;
}

export async function sendMessage(
  messages: Message[],
  financialData?: FinancialData | null,
  profileId?: string
): Promise<AIResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  // Chamada exclusiva para a Rota de API Serverless do Vercel
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages, financialData, profileId }),
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
