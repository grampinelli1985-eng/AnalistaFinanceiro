// ==========================================
// TIPOS PRINCIPAIS DA APLICAÇÃO FINANCEIRA
// ==========================================

export interface MessageAttachment {
  mimeType: string; // ex: 'application/pdf'
  data: string; // conteúdo do arquivo em base64 (sem o prefixo data:...)
  fileName: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
  attachments?: MessageAttachment[];
}

export interface Income {
  salary: number;
  freelance: number;
  other: number;
  eventualBonus: number;
}

export interface FixedExpenses {
  rent: number;
  vehicleLoan: number;
  healthPlan: number;
  internet: number;
  phone: number;
  streaming: number;
  subscriptions: number;
  water: number;
  electricity: number;
  gas: number;
  carInsurance: number;
  homeInsurance: number;
  education: number;
  other: number;
}

export interface VariableExpenses {
  food: number;
  restaurants: number;
  transport: number;
  leisure: number;
  shopping: number;
  health: number;
  pets: number;
  personalCare: number;
  other: number;
}

export interface SeasonalExpense {
  id: string;
  name: string;
  annualAmount: number;
  monthDue: number; // 1-12, mês em que o gasto geralmente ocorre
}

export interface Debt {
  id: string;
  name: string;
  type: 'credit_card' | 'overdraft' | 'personal_loan' | 'other';
  totalAmount: number;
  monthlyPayment: number;
  monthlyInterestRate: number;
  remainingMonths: number;
}

export interface Savings {
  currentAmount: number;
  emergencyFundMonths: number;
}

export type HealthLevel = 'critical' | 'concerning' | 'attention' | 'healthy';

export interface FinancialBalance {
  totalIncome: number;
  totalFixedExpenses: number;
  totalVariableExpenses: number;
  totalSeasonalMonthly: number;
  totalDebtPayments: number;
  totalExpenses: number;
  monthlyBalance: number;
  totalDebts: number;
  incomeCommitmentIndex: number;
  healthLevel: HealthLevel;
  savingsInMonths: number;
}

export interface FinancialData {
  userName: string;
  income: Income;
  fixedExpenses: FixedExpenses;
  variableExpenses: VariableExpenses;
  seasonalExpenses: SeasonalExpense[];
  debts: Debt[];
  savings: Savings;
  lastUpdated: string;
}

export interface MonthlySnapshot {
  month: string; // "YYYY-MM"
  balance: FinancialBalance;
  financialData: FinancialData;
  notes: string;
}

// ==========================================
// SISTEMA DE MÚLTIPLOS PERFIS
// ==========================================

export const PROFILE_AVATARS = [
  '👤', '👩', '👩🏻', '👩🏽', '👩🏿', 
  '👨', '👨🏻', '👨🏽', '👨🏿', 
  '👧', '👧🏻', '👧🏽', '👧🏿', 
  '👦', '👦🏻', '👦🏽', '👦🏿', 
  '👴', '👴🏻', '👴🏽', '👴🏿', 
  '👵', '👵🏻', '👵🏽', '👵🏿',
  '💼', '👫', '👨‍👩‍👧', '🏠', '⭐',
];

export const PROFILE_COLORS = [
  '#6366f1', // Índigo
  '#10b981', // Verde
  '#f97316', // Laranja
  '#ec4899', // Rosa
  '#06b6d4', // Ciano
  '#8b5cf6', // Violeta
  '#eab308', // Amarelo
  '#ef4444', // Vermelho
];

export interface Profile {
  id: string;
  name: string;
  avatar: string;       // emoji
  color: string;        // hex color
  createdAt: string;
  allowFamilyView: boolean;
  reportGeneratedAt?: string | null;
}

export interface GlobalConfig {
  apiKey: string;
  activeProfileId: string | null;
  profiles: Profile[];
  version: number;      // para migrações futuras
}

export interface FamilyViewConfig {
  participatingProfileIds: string[];
  isActive: boolean;
}

export interface ProfileBreakdown {
  profile: Profile;
  balance: FinancialBalance;
  financialData: FinancialData;
}

export interface FamilyBalance {
  totalFamilyIncome: number;
  totalFamilyFixedExpenses: number;
  totalFamilyVariableExpenses: number;
  totalFamilyDebtPayments: number;
  totalFamilyExpenses: number;
  totalFamilyBalance: number;
  totalFamilyDebts: number;
  totalFamilySavings: number;
  profileBreakdowns: ProfileBreakdown[];
}

/** @deprecated Substituído por GlobalConfig + Profile */
export interface UserProfile {
  name: string;
  createdAt: string;
  apiKey: string;
}

export interface AppState {
  userProfile: UserProfile | null;
  financialData: FinancialData | null;
  chatHistory: Message[];
  monthlySnapshots: MonthlySnapshot[];
  currentBalance: FinancialBalance | null;
  onboardingStep: number;
  isOnboardingComplete: boolean;
}

// Constantes de configuração
export const HEALTH_LEVELS: Record<HealthLevel, { label: string; color: string; emoji: string; description: string }> = {
  critical: {
    label: 'CRÍTICO',
    color: '#ef4444',
    emoji: '🔴',
    description: 'Risco de insolvência — renda não cobre despesas ou dívidas crescendo descontroladamente',
  },
  concerning: {
    label: 'PREOCUPANTE',
    color: '#f97316',
    emoji: '🟠',
    description: 'Saldo positivo pequeno com dívidas altas — estagnação financeira',
  },
  attention: {
    label: 'ATENÇÃO',
    color: '#eab308',
    emoji: '🟡',
    description: 'Situação controlável, mas com riscos — melhorias necessárias',
  },
  healthy: {
    label: 'SAUDÁVEL',
    color: '#10b981',
    emoji: '🟢',
    description: 'Boa margem com dívidas sob controle — foco em crescimento',
  },
};
