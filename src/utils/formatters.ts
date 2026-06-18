// ==========================================
// UTILITÁRIOS DE FORMATAÇÃO
// ==========================================

/**
 * Formata valor para moeda brasileira (R$)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata percentual
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Formata mês no formato "Junho 2025"
 */
export function formatMonth(date: Date = new Date()): string {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

/**
 * Formata data/hora
 */
export function formatDateTime(date: Date): string {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Gera ID único
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Obtém mês atual no formato "YYYY-MM"
 */
export function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Parseia valor em real (aceita "1.500,00" ou "1500" ou "1500.00")
 */
export function parseCurrencyInput(value: string): number {
  if (!value) return 0;
  
  // Clean the input to keep only digits, dots, commas, and a leading minus sign if negative
  const isNegative = value.trim().startsWith('-');
  let cleaned = value.replace(/[^\d,.]/g, '');

  if (cleaned.includes('.') && cleaned.includes(',')) {
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    const commaCount = (cleaned.match(/,/g) || []).length;
    if (commaCount === 1) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes('.')) {
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount === 1) {
      const parts = cleaned.split('.');
      const decimalPart = parts[1];
      if (decimalPart.length === 3) {
        cleaned = cleaned.replace('.', '');
      }
    } else {
      cleaned = cleaned.replace(/\./g, '');
    }
  }

  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return isNegative ? -parsed : parsed;
}

/**
 * Extrai número de uma string com unidade (ex: "6 meses" → 6)
 */
export function extractNumber(text: string): number {
  const match = text.match(/[\d.,]+/);
  if (!match) return 0;
  return parseCurrencyInput(match[0]);
}

/**
 * Classifica porcentagem de comprometimento de renda
 */
export function classifyCommitmentIndex(index: number): string {
  if (index >= 80) return 'Comprometimento extremo — situação insustentável';
  if (index >= 60) return 'Comprometimento alto — pouca margem para imprevistos';
  if (index >= 40) return 'Comprometimento moderado — ainda há espaço para melhoria';
  return 'Comprometimento saudável — boa margem de sobra';
}
