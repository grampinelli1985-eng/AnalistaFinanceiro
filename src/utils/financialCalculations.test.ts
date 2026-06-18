import { describe, it, expect } from 'vitest';
import { calculateFinancialBalance, calculateHealthLevel } from './financialCalculations';
import type { FinancialData } from '../types/financial';

describe('financialCalculations', () => {
  it('should correctly calculate the financial balance without duplications', () => {
    const data: FinancialData = {
      userName: 'Test User',
      income: {
        salary: 5000,
        freelance: 1000,
        other: 0,
        eventualBonus: 0,
      },
      fixedExpenses: {
        rent: 1500,
        vehicleLoan: 0,
        healthPlan: 300,
        internet: 100,
        phone: 50,
        streaming: 50,
        subscriptions: 0,
        other: 0,
      },
      variableExpenses: {
        food: 800,
        restaurants: 200,
        transport: 150,
        leisure: 100,
        shopping: 0,
        other: 0,
      },
      debts: [
        {
          id: 'debt-1',
          name: 'Cartão de Crédito',
          type: 'credit_card',
          totalAmount: 2000,
          monthlyPayment: 500,
          monthlyInterestRate: 12,
          remainingMonths: 4,
        },
        {
          id: 'debt-2',
          name: 'Parcelamento Geladeira',
          type: 'other',
          totalAmount: 1000,
          monthlyPayment: 200,
          monthlyInterestRate: 0,
          remainingMonths: 5,
        }
      ],
      savings: {
        currentAmount: 10000,
        emergencyFundMonths: 0,
      },
      lastUpdated: new Date().toISOString(),
    };

    const balance = calculateFinancialBalance(data);

    expect(balance.totalIncome).toBe(6000); // 5000 + 1000
    expect(balance.totalFixedExpenses).toBe(2000); // 1500 + 300 + 100 + 50 + 50
    expect(balance.totalVariableExpenses).toBe(1250); // 800 + 200 + 150 + 100
    expect(balance.totalDebtPayments).toBe(700); // 500 + 200
    
    expect(balance.totalExpenses).toBe(3950); // 2000 + 1250 + 700
    expect(balance.monthlyBalance).toBe(2050); // 6000 - 3950
    
    expect(balance.totalDebts).toBe(3000); // 2000 + 1000
    
    // (2000 + 700) / 6000 * 100 = 45
    expect(balance.incomeCommitmentIndex).toBe(45);
    
    // 10000 / (2000 + 1250) = 3.076... -> 3.1
    expect(balance.savingsInMonths).toBe(3.1);
    
    // Health level is healthy because monthlyBalance > 6000*0.1 (600) and commitment < 50
    expect(balance.healthLevel).toBe('healthy');
  });

  it('should calculate correctly with zero income and high debts', () => {
    const data: FinancialData = {
      userName: 'Test User',
      income: { salary: 0, freelance: 0, other: 0, eventualBonus: 0 },
      fixedExpenses: { rent: 1000, vehicleLoan: 0, healthPlan: 0, internet: 0, phone: 0, streaming: 0, subscriptions: 0, other: 0 },
      variableExpenses: { food: 500, restaurants: 0, transport: 0, leisure: 0, shopping: 0, other: 0 },
      debts: [
        { id: 'd1', name: 'Cheque especial', type: 'other', totalAmount: 5000, monthlyPayment: 500, monthlyInterestRate: 8, remainingMonths: 10 }
      ],
      savings: { currentAmount: 0, emergencyFundMonths: 0 }
    };

    const balance = calculateFinancialBalance(data);

    expect(balance.totalIncome).toBe(0);
    expect(balance.totalExpenses).toBe(2000);
    expect(balance.monthlyBalance).toBe(-2000);
    expect(balance.incomeCommitmentIndex).toBe(100);
    expect(balance.healthLevel).toBe('critical');
  });
});
