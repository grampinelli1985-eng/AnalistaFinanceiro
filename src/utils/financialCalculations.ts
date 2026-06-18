// ==========================================
// CÁLCULOS FINANCEIROS
// ==========================================

import type { FinancialData, FinancialBalance, HealthLevel, Debt } from '../types/financial';

/**
 * Calcula o balanço financeiro completo
 */
export function calculateFinancialBalance(data: FinancialData): FinancialBalance {
  // Entradas
  const totalIncome =
    (data.income.salary || 0) +
    (data.income.freelance || 0) +
    (data.income.other || 0);

  // Despesas fixas
  const totalFixedExpenses =
    (data.fixedExpenses.rent || 0) +
    (data.fixedExpenses.vehicleLoan || 0) +
    (data.fixedExpenses.healthPlan || 0) +
    (data.fixedExpenses.internet || 0) +
    (data.fixedExpenses.phone || 0) +
    (data.fixedExpenses.streaming || 0) +
    (data.fixedExpenses.subscriptions || 0) +
    (data.fixedExpenses.other || 0);

  // Despesas variáveis
  const totalVariableExpenses =
    (data.variableExpenses.food || 0) +
    (data.variableExpenses.restaurants || 0) +
    (data.variableExpenses.transport || 0) +
    (data.variableExpenses.leisure || 0) +
    (data.variableExpenses.shopping || 0) +
    (data.variableExpenses.other || 0);

  // Parcelas de dívidas
  const totalDebtPayments = data.debts.reduce(
    (sum, debt) => sum + (debt.monthlyPayment || 0),
    0
  );

  const totalExpenses = totalFixedExpenses + totalVariableExpenses + totalDebtPayments;
  const monthlyBalance = totalIncome - totalExpenses;

  // Total de dívidas
  const totalDebts = data.debts.reduce(
    (sum, debt) => sum + (debt.totalAmount || 0),
    0
  );

  // Índice de comprometimento = (despesas fixas + parcelas) / renda * 100
  const incomeCommitmentIndex =
    totalIncome > 0
      ? Math.round(((totalFixedExpenses + totalDebtPayments) / totalIncome) * 100)
      : 100;

  // Meses de reserva
  const monthlyEssentials = totalFixedExpenses + totalVariableExpenses;
  const savingsInMonths =
    monthlyEssentials > 0
      ? parseFloat((data.savings.currentAmount / monthlyEssentials).toFixed(1))
      : 0;

  // Nível de saúde financeira
  const healthLevel = calculateHealthLevel(
    monthlyBalance,
    totalDebts,
    totalIncome,
    incomeCommitmentIndex
  );

  return {
    totalIncome,
    totalFixedExpenses,
    totalVariableExpenses,
    totalDebtPayments,
    totalExpenses,
    monthlyBalance,
    totalDebts,
    incomeCommitmentIndex,
    healthLevel,
    savingsInMonths,
  };
}

/**
 * Determina nível de saúde financeira
 */
export function calculateHealthLevel(
  monthlyBalance: number,
  totalDebts: number,
  totalIncome: number,
  commitmentIndex: number
): HealthLevel {
  if (monthlyBalance < 0 || commitmentIndex >= 90) return 'critical';
  if (commitmentIndex >= 70 || (totalDebts > totalIncome * 6)) return 'concerning';
  if (commitmentIndex >= 50 || monthlyBalance < totalIncome * 0.1) return 'attention';
  return 'healthy';
}

/**
 * Simula quitação de dívidas pelo método Avalanche (maior juros primeiro)
 */
export function simulateAvalanchePayoff(
  debts: Debt[],
  extraMonthlyPayment: number
): { months: number; totalInterestPaid: number; payoffSchedule: PayoffMonth[] } {
  if (debts.length === 0) return { months: 0, totalInterestPaid: 0, payoffSchedule: [] };

  // Ordena por maior taxa de juros
  const sortedDebts = [...debts].sort(
    (a, b) => b.monthlyInterestRate - a.monthlyInterestRate
  );

  let remainingDebts = sortedDebts.map((d) => ({ ...d, remaining: d.totalAmount }));
  let totalInterestPaid = 0;
  const payoffSchedule: PayoffMonth[] = [];
  let month = 0;

  while (remainingDebts.some((d) => d.remaining > 0) && month < 360) {
    month++;
    let extra = extraMonthlyPayment;
    const monthData: PayoffMonth = { month, debts: [], totalRemaining: 0 };

    remainingDebts = remainingDebts.map((debt) => {
      if (debt.remaining <= 0) return debt;

      // Aplica juros
      const interest = debt.remaining * (debt.monthlyInterestRate / 100);
      totalInterestPaid += interest;
      debt.remaining += interest;

      // Pagamento mínimo + extra (apenas para primeira dívida da lista)
      const payment = debt.monthlyPayment + extra;
      extra = Math.max(0, extra - (payment - debt.monthlyPayment));
      debt.remaining = Math.max(0, debt.remaining - payment);

      return debt;
    });

    monthData.debts = remainingDebts.map((d) => ({ name: d.name, remaining: d.remaining }));
    monthData.totalRemaining = remainingDebts.reduce((s, d) => s + d.remaining, 0);
    payoffSchedule.push(monthData);

    if (remainingDebts.every((d) => d.remaining <= 0)) break;
  }

  return { months: month, totalInterestPaid, payoffSchedule };
}

/**
 * Simula quitação pelo método Bola de Neve (menor valor primeiro)
 */
export function simulateSnowballPayoff(
  debts: Debt[],
  extraMonthlyPayment: number
): { months: number; totalInterestPaid: number } {
  if (debts.length === 0) return { months: 0, totalInterestPaid: 0 };

  const sortedDebts = [...debts]
    .sort((a, b) => a.totalAmount - b.totalAmount)
    .map((d) => ({ ...d, remaining: d.totalAmount }));

  let totalInterestPaid = 0;
  let month = 0;

  while (sortedDebts.some((d) => d.remaining > 0) && month < 360) {
    month++;
    let extra = extraMonthlyPayment;

    sortedDebts.forEach((debt) => {
      if (debt.remaining <= 0) return;
      const interest = debt.remaining * (debt.monthlyInterestRate / 100);
      totalInterestPaid += interest;
      debt.remaining += interest;
      const payment = debt.monthlyPayment + extra;
      extra = Math.max(0, extra - (payment - debt.monthlyPayment));
      debt.remaining = Math.max(0, debt.remaining - payment);
    });
  }

  return { months: month, totalInterestPaid };
}

/**
 * Calcula meta de reserva de emergência (6 meses de despesas essenciais)
 */
export function calculateEmergencyFundGoal(
  totalFixedExpenses: number,
  totalVariableExpenses: number,
  targetMonths = 6
): number {
  return (totalFixedExpenses + totalVariableExpenses) * targetMonths;
}

/**
 * Estima prazo para atingir reserva
 */
export function estimateEmergencyFundTimeline(
  currentSavings: number,
  goalAmount: number,
  monthlySaving: number
): number {
  if (monthlySaving <= 0) return Infinity;
  const needed = Math.max(0, goalAmount - currentSavings);
  return Math.ceil(needed / monthlySaving);
}

export interface PayoffMonth {
  month: number;
  debts: { name: string; remaining: number }[];
  totalRemaining: number;
}
