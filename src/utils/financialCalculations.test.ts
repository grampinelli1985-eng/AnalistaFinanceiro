import { describe, it, expect } from 'vitest';
import { calculateFinancialBalance, calculateHealthLevel, simulateAvalanchePayoff, simulateSnowballPayoff } from './financialCalculations';
import type { FinancialData, Debt } from '../types/financial';

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
        water: 0,
        electricity: 0,
        gas: 0,
        carInsurance: 0,
        homeInsurance: 0,
        education: 0,
        other: 0,
      },
      variableExpenses: {
        food: 800,
        restaurants: 200,
        transport: 150,
        leisure: 100,
        shopping: 0,
        health: 0,
        pets: 0,
        personalCare: 0,
        other: 0,
      },
      seasonalExpenses: [],
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
      fixedExpenses: { rent: 1000, vehicleLoan: 0, healthPlan: 0, internet: 0, phone: 0, streaming: 0, subscriptions: 0, water: 0, electricity: 0, gas: 0, carInsurance: 0, homeInsurance: 0, education: 0, other: 0 },
      variableExpenses: { food: 500, restaurants: 0, transport: 0, leisure: 0, shopping: 0, health: 0, pets: 0, personalCare: 0, other: 0 },
      seasonalExpenses: [],
      debts: [
        { id: 'd1', name: 'Cheque especial', type: 'other', totalAmount: 5000, monthlyPayment: 500, monthlyInterestRate: 8, remainingMonths: 10 }
      ],
      savings: { currentAmount: 0, emergencyFundMonths: 0 },
      lastUpdated: new Date().toISOString(),
    };

    const balance = calculateFinancialBalance(data);

    expect(balance.totalIncome).toBe(0);
    expect(balance.totalExpenses).toBe(2000);
    expect(balance.monthlyBalance).toBe(-2000);
    expect(balance.incomeCommitmentIndex).toBe(100);
    expect(balance.healthLevel).toBe('critical');
  });

  it('should correctly dilute seasonal expenses (annual/year) into the monthly total', () => {
    const data: FinancialData = {
      userName: 'Test User',
      income: { salary: 6000, freelance: 0, other: 0, eventualBonus: 0 },
      fixedExpenses: { rent: 1500, vehicleLoan: 0, healthPlan: 0, internet: 0, phone: 0, streaming: 0, subscriptions: 0, water: 0, electricity: 0, gas: 0, carInsurance: 0, homeInsurance: 0, education: 0, other: 0 },
      variableExpenses: { food: 0, restaurants: 0, transport: 0, leisure: 0, shopping: 0, health: 0, pets: 0, personalCare: 0, other: 0 },
      seasonalExpenses: [
        { id: 's1', name: 'IPVA', annualAmount: 1200, monthDue: 1 },
        { id: 's2', name: 'Seguro Residencial', annualAmount: 600, monthDue: 6 },
      ],
      debts: [],
      savings: { currentAmount: 0, emergencyFundMonths: 0 },
      lastUpdated: new Date().toISOString(),
    };

    const balance = calculateFinancialBalance(data);

    // (1200 + 600) / 12 = 150
    expect(balance.totalSeasonalMonthly).toBe(150);
    expect(balance.totalExpenses).toBe(1650); // 1500 (fixed) + 0 (variable) + 150 (seasonal)
    expect(balance.monthlyBalance).toBe(4350); // 6000 - 1650
  });

  describe('calculateHealthLevel', () => {
    it('returns critical when monthlyBalance is negative, regardless of other values', () => {
      expect(calculateHealthLevel(-100, 1000, 5000, 20)).toBe('critical');
    });

    it('returns critical when commitmentIndex >= 90', () => {
      expect(calculateHealthLevel(500, 1000, 5000, 90)).toBe('critical');
    });

    it('returns concerning when commitmentIndex >= 70 (but below 90)', () => {
      expect(calculateHealthLevel(500, 1000, 5000, 75)).toBe('concerning');
    });

    it('returns concerning when totalDebts > totalIncome * 6', () => {
      expect(calculateHealthLevel(500, 40000, 5000, 20)).toBe('concerning');
    });

    it('returns attention when commitmentIndex >= 50 (but below 70)', () => {
      expect(calculateHealthLevel(500, 1000, 5000, 55)).toBe('attention');
    });

    it('returns attention when monthlyBalance is below 10% of income', () => {
      // 5000 * 0.1 = 500; saldo de 400 fica abaixo disso
      expect(calculateHealthLevel(400, 1000, 5000, 20)).toBe('attention');
    });

    it('returns healthy when balance is solid and commitment is low', () => {
      expect(calculateHealthLevel(2000, 1000, 6000, 20)).toBe('healthy');
    });
  });
});

describe('simulações de quitação de dívidas', () => {
  const debt = (id: string, totalAmount: number, monthlyPayment: number, monthlyInterestRate: number): Debt => ({
    id, name: id, type: 'other', totalAmount, monthlyPayment, monthlyInterestRate, remainingMonths: 0,
  });

  it('sem juros: quita no prazo exato da soma das parcelas + extra', () => {
    // Orçamento mensal = 100 + 100 + 200 de extra = 400; total 1200 → 3 meses
    const result = simulateAvalanchePayoff([debt('a', 600, 100, 0), debt('b', 600, 100, 0)], 200);
    expect(result.months).toBe(3);
    expect(result.totalInterestPaid).toBe(0);
    expect(result.paidOff).toBe(true);
  });

  it('a parcela de uma dívida quitada passa para a próxima (efeito bola de neve)', () => {
    // a: 100 em 1 mês. Depois disso b recebe 100 + 100 = 200/mês.
    // b: mês 1 paga 100 (sobra 900), meses 2..6 pagam 200 → 900 - 1000 < 0 → quita no mês 6
    const result = simulateSnowballPayoff([debt('a', 100, 100, 0), debt('b', 1000, 100, 0)], 0);
    expect(result.months).toBe(6);
  });

  it('o extra não se perde quando a dívida prioritária já foi quitada', () => {
    // Bug antigo: o extra ia só para a primeira dívida da lista, mesmo já quitada.
    const result = simulateAvalanchePayoff([debt('cara', 50, 50, 10), debt('barata', 1000, 50, 0)], 450);
    // Mês 1: juros 5 → cara 55; paga 50 mínimo + 5 do extra; barata recebe 50 + 445 → resta 505
    // Mês 2: barata recebe todo o orçamento (550) → quitada
    expect(result.months).toBe(2);
    expect(result.totalInterestPaid).toBeCloseTo(5, 5);
  });

  it('avalanche paga menos juros que bola de neve quando a dívida cara é a maior', () => {
    const debts = [debt('cartao', 3000, 200, 8), debt('emprestimo', 1000, 100, 2)];
    const avalanche = simulateAvalanchePayoff(debts, 300);
    const snowball = simulateSnowballPayoff(debts, 300);
    expect(avalanche.totalInterestPaid).toBeLessThan(snowball.totalInterestPaid);
    expect(avalanche.paidOff && snowball.paidOff).toBe(true);
  });

  it('indica quando a parcela não cobre os juros (dívida impagável)', () => {
    const result = simulateAvalanchePayoff([debt('rotativo', 10000, 100, 10)], 0);
    expect(result.paidOff).toBe(false);
    expect(result.months).toBe(360);
  });

  it('não altera o array de dívidas recebido', () => {
    const debts = [debt('a', 500, 100, 5)];
    simulateAvalanchePayoff(debts, 0);
    expect(debts[0].totalAmount).toBe(500);
  });
});
