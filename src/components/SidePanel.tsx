// ==========================================
// PAINEL LATERAL — RESUMO FINANCEIRO
// ==========================================

import React, { useState } from 'react';
import type { FinancialData, FinancialBalance, MonthlySnapshot } from '../types/financial';
import { HEALTH_LEVELS } from '../types/financial';
import { formatCurrency, formatPercent, classifyCommitmentIndex } from '../utils/formatters';
import type { SubscriptionData } from '../services/storageService';
import ChartsPanel from './ChartsPanel';

interface SidePanelProps {
  financialData: FinancialData | null;
  balance: FinancialBalance | null;
  snapshots: MonthlySnapshot[];
  onExportPDF: () => void;
  onResetData: () => void;
  onSyncData?: () => void;
  className?: string;
  subscription?: SubscriptionData | null;
  messagesRemaining?: number | null;
  onUpgradeClick?: () => void;
}

type TabType = 'resumo' | 'graficos' | 'historico';

const SidePanel: React.FC<SidePanelProps> = ({
  financialData,
  balance,
  snapshots,
  onExportPDF,
  onResetData,
  onSyncData,
  className = '',
  subscription = null,
  messagesRemaining = null,
  onUpgradeClick,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('resumo');

  const commitmentBarClass =
    !balance ? ''
    : balance.incomeCommitmentIndex >= 80 ? 'very-high'
    : balance.incomeCommitmentIndex >= 60 ? 'high'
    : balance.incomeCommitmentIndex >= 40 ? 'medium'
    : 'low';

  const healthInfo = balance ? HEALTH_LEVELS[balance.healthLevel] : null;

  return (
    <aside className={`side-panel ${className}`}>
      {/* Abas */}
      <div className="side-panel-tabs" role="tablist">
        {(['resumo', 'graficos', 'historico'] as TabType[]).map((tab) => (
          <button
            key={tab}
            id={`tab-${tab}`}
            className={`side-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            role="tab"
            aria-selected={activeTab === tab}
          >
            {tab === 'resumo' ? '📊 Resumo' : tab === 'graficos' ? '📈 Gráficos' : '📅 Histórico'}
          </button>
        ))}
      </div>

      {/* Conteúdo das Abas */}
      <div className="side-panel-content">

        {/* ── ABA RESUMO ──────────────────────────── */}
        {activeTab === 'resumo' && (
          <>
            {/* Badge de Saúde */}
            {healthInfo && balance && (
              <div className={`health-badge ${balance.healthLevel}`} role="status">
                <span>{healthInfo.emoji}</span>
                <span>{healthInfo.label}</span>
              </div>
            )}

            {!balance ? (
              <div className="empty-state">
                <div className="empty-state-icon">💰</div>
                <div className="empty-state-title">Aguardando dados</div>
                <p className="empty-state-text">
                  Converse com o analista para gerar seu balanço financeiro.
                </p>
              </div>
            ) : (
              <>
                {/* Card de Progresso da Jornada (Retenção) */}
                <div className="card" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(15, 23, 42, 0.2) 100%)', border: '1px solid rgba(99, 102, 241, 0.2)', marginBottom: 'var(--space-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-accent)', letterSpacing: '0.5px' }}>🎯 JORNADA FINANCEIRA</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Etapa 1 de 3</span>
                  </div>
                  <strong style={{ display: 'block', fontSize: '0.9rem', marginBottom: '8px', color: 'var(--color-text-primary)' }}>Mês 1: Revisão de Gastos Fixos</strong>
                  <div className="commitment-bar-track" style={{ height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', marginBottom: '12px' }}>
                    <div 
                      className="commitment-bar-fill" 
                      style={{ width: '33%', background: 'linear-gradient(90deg, var(--color-accent), #4f46e5)', height: '100%', borderRadius: '3px' }} 
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: 'var(--color-healthy)' }}>✓</span>
                      <span>Dados iniciais coletados e analisados</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>⏳</span>
                      <span>Plano de ação ativado (Acompanhamento Mês 1)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.5 }}>
                      <span>🔒</span>
                      <span>Mês 2: Reserva de Emergência (Em 30 dias)</span>
                    </div>
                  </div>
                </div>

                {/* Card de Assinatura e Monetização */}
                {subscription && (
                  <div className="card" style={{ background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', letterSpacing: '0.5px' }}>💳 PLANO ATIVO</span>
                      <span 
                        style={{ 
                          fontSize: '0.75rem', 
                          fontWeight: 'bold',
                          color: subscription.status === 'trial' ? 'var(--color-accent)' : subscription.status === 'active' ? 'var(--color-healthy)' : 'var(--color-critical)',
                          textTransform: 'uppercase'
                        }}
                      >
                        {subscription.status === 'trial' ? 'Teste (BETA)' : subscription.status === 'active' ? 'Ativo' : 'Atenção'}
                      </span>
                    </div>
                    <strong style={{ display: 'block', fontSize: '1rem', marginBottom: '4px', color: 'var(--color-text-primary)' }}>
                      {subscription.plans?.name || 'Beta Trial'}
                    </strong>
                    {subscription.status === 'trial' && subscription.trial_ends_at && (
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                        Expira em: {new Date(subscription.trial_ends_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                    {typeof messagesRemaining === 'number' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', marginTop: '6px', padding: '6px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                        <span>Mensagens restantes hoje:</span>
                        <strong style={{ color: messagesRemaining === 0 ? 'var(--color-critical)' : 'var(--color-healthy)' }}>{messagesRemaining}</strong>
                      </div>
                    )}
                    {subscription.plan_id !== 'family' && onUpgradeClick && (
                      <button 
                        onClick={onUpgradeClick}
                        className="btn btn-ghost"
                        style={{ width: '100%', padding: '6px 12px', fontSize: '0.8rem', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--color-accent)', borderColor: 'var(--color-accent)' }}
                      >
                        🚀 Fazer Upgrade / Assinar
                      </button>
                    )}
                  </div>
                )}

                {/* Saldo mensal em destaque */}
                <div className={`balance-highlight ${balance.monthlyBalance >= 0 ? 'positive' : 'negative'}`}>
                  <div className="balance-highlight-label">Saldo Mensal</div>
                  <div className={`balance-highlight-value ${balance.monthlyBalance >= 0 ? 'value-green' : 'value-red'}`}>
                    {formatCurrency(balance.monthlyBalance)}
                  </div>
                </div>

                {/* Entradas */}
                <div className="card">
                  <div className="card-title">✅ Entradas Mensais</div>
                  <div className="summary-section">
                    {financialData?.income.salary ? (
                      <div className="summary-row">
                        <span className="summary-row-label">Salário</span>
                        <span className="summary-row-value value-green">{formatCurrency(financialData.income.salary)}</span>
                      </div>
                    ) : null}
                    {(financialData?.income.freelance || 0) > 0 && (
                      <div className="summary-row">
                        <span className="summary-row-label">Freelance</span>
                        <span className="summary-row-value value-green">{formatCurrency(financialData!.income.freelance)}</span>
                      </div>
                    )}
                    {(financialData?.income.other || 0) > 0 && (
                      <div className="summary-row">
                        <span className="summary-row-label">Outras fontes</span>
                        <span className="summary-row-value value-green">{formatCurrency(financialData!.income.other)}</span>
                      </div>
                    )}
                    <div className="summary-total">
                      <span className="summary-total-label">TOTAL ENTRADAS</span>
                      <span className="summary-total-value value-green">{formatCurrency(balance.totalIncome)}</span>
                    </div>
                  </div>
                </div>

                {/* Saídas */}
                <div className="card">
                  <div className="card-title">🔴 Saídas Mensais</div>
                  <div className="summary-section">
                    <div className="summary-row">
                      <span className="summary-row-label">Despesas fixas</span>
                      <span className="summary-row-value">{formatCurrency(balance.totalFixedExpenses)}</span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-row-label">Despesas variáveis</span>
                      <span className="summary-row-value">{formatCurrency(balance.totalVariableExpenses)}</span>
                    </div>
                    {balance.totalSeasonalMonthly > 0 && (
                      <div className="summary-row">
                        <span className="summary-row-label">Sazonais (IPVA, manutenção, ÷12)</span>
                        <span className="summary-row-value">{formatCurrency(balance.totalSeasonalMonthly)}</span>
                      </div>
                    )}
                    {balance.totalDebtPayments > 0 && (
                      <div className="summary-row">
                        <span className="summary-row-label">Parcelas de dívidas</span>
                        <span className="summary-row-value value-red">{formatCurrency(balance.totalDebtPayments)}</span>
                      </div>
                    )}
                    <div className="summary-total">
                      <span className="summary-total-label">TOTAL SAÍDAS</span>
                      <span className="summary-total-value value-red">{formatCurrency(balance.totalExpenses)}</span>
                    </div>
                  </div>
                </div>

                {/* Dívidas */}
                {financialData && financialData.debts.length > 0 && (
                  <div className="card">
                    <div className="card-title">💳 Dívidas</div>
                    {financialData.debts.map((debt) => (
                      <div key={debt.id} className="debt-item">
                        <div className="debt-item-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="debt-item-name">{debt.name}</span>
                            <span className={`debt-badge ${debt.type}`}>
                              {debt.type === 'credit_card' ? 'Cartão'
                                : debt.type === 'personal_loan' ? 'Empréstimo'
                                : debt.type === 'overdraft' ? 'Cheque esp.'
                                : 'Outro'}
                            </span>
                          </div>
                          <span className="debt-item-amount">{formatCurrency(debt.totalAmount)}</span>
                        </div>
                        <div className="debt-item-detail">
                          Parcela: {formatCurrency(debt.monthlyPayment)}
                          {debt.monthlyInterestRate > 0 && ` · Juros: ${formatPercent(debt.monthlyInterestRate)}/mês`}
                          {debt.remainingMonths > 0 && ` · ${debt.remainingMonths} meses restantes`}
                        </div>
                      </div>
                    ))}
                    <div className="summary-total" style={{ marginTop: '8px' }}>
                      <span className="summary-total-label">TOTAL DÍVIDAS</span>
                      <span className="summary-total-value value-red">{formatCurrency(balance.totalDebts)}</span>
                    </div>
                  </div>
                )}

                {/* Gastos Sazonais */}
                {financialData && financialData.seasonalExpenses && financialData.seasonalExpenses.length > 0 && (
                  <div className="card">
                    <div className="card-title">📅 Gastos Sazonais (IPVA, manutenção, etc.)</div>
                    {financialData.seasonalExpenses.map((exp) => {
                      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
                      const monthLabel = monthNames[Math.max(0, Math.min(11, exp.monthDue - 1))];
                      return (
                        <div key={exp.id} className="debt-item">
                          <div className="debt-item-header">
                            <span className="debt-item-name">{exp.name}</span>
                            <span className="debt-item-amount">{formatCurrency(exp.annualAmount)}/ano</span>
                          </div>
                          <div className="debt-item-detail">
                            Ocorre em: {monthLabel} · Diluído: {formatCurrency(exp.annualAmount / 12)}/mês
                          </div>
                        </div>
                      );
                    })}
                    <div className="summary-total" style={{ marginTop: '8px' }}>
                      <span className="summary-total-label">TOTAL DILUÍDO/MÊS</span>
                      <span className="summary-total-value">{formatCurrency(balance.totalSeasonalMonthly)}</span>
                    </div>
                  </div>
                )}

                {/* Comprometimento de Renda */}
                <div className="card">
                  <div className="card-title">📊 Comprometimento de Renda</div>
                  <div className="commitment-bar-container">
                    <div className="commitment-label">
                      <span>0%</span>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: commitmentBarClass === 'low' ? 'var(--color-healthy)' : commitmentBarClass === 'medium' ? 'var(--color-attention)' : 'var(--color-critical)' }}>
                        {formatPercent(balance.incomeCommitmentIndex, 0)}
                      </span>
                      <span>100%</span>
                    </div>
                    <div className="commitment-bar-track">
                      <div
                        className={`commitment-bar-fill ${commitmentBarClass}`}
                        style={{ width: `${Math.min(100, balance.incomeCommitmentIndex)}%` }}
                      />
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {classifyCommitmentIndex(balance.incomeCommitmentIndex)}
                    </div>
                  </div>
                </div>

                {/* Reservas */}
                {financialData && (
                  <div className="card">
                    <div className="card-title">🏦 Reservas Atuais</div>
                    <div className="summary-row">
                      <span className="summary-row-label">Poupança/Investimentos</span>
                      <span className="summary-row-value value-green">{formatCurrency(financialData.savings.currentAmount)}</span>
                    </div>
                    <div className="summary-row">
                      <span className="summary-row-label">Equivale a</span>
                      <span className="summary-row-value">
                        {balance.savingsInMonths === Infinity || balance.savingsInMonths > 99 ? '99+' : balance.savingsInMonths.toFixed(1)} {balance.savingsInMonths === 1 ? 'mês' : 'meses'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Ações */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {onSyncData && (
                    <button
                      className="btn btn-primary w-full"
                      onClick={onSyncData}
                    >
                      🔄 Forçar Sincronização do Painel
                    </button>
                  )}
                  <button
                    id="export-pdf-btn"
                    className="btn btn-ghost w-full"
                    onClick={onExportPDF}
                  >
                    📄 Exportar Relatório PDF
                  </button>
                  <button
                    id="reset-data-btn"
                    className="btn btn-danger btn-sm w-full"
                    onClick={onResetData}
                  >
                    🗑️ Resetar todos os dados
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── ABA GRÁFICOS ─────────────────────────── */}
        {activeTab === 'graficos' && (
          <ChartsPanel
            financialData={financialData}
            balance={balance}
            snapshots={snapshots}
          />
        )}

        {/* ── ABA HISTÓRICO ────────────────────────── */}
        {activeTab === 'historico' && (
          <>
            {snapshots.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📅</div>
                <div className="empty-state-title">Sem histórico ainda</div>
                <p className="empty-state-text">
                  O histórico mensal ficará disponível após você registrar dados em meses diferentes.
                </p>
              </div>
            ) : (
              <>
                <div className="card-title" style={{ padding: '0 0 8px' }}>
                  {snapshots.length} registro(s) mensais
                </div>
                {[...snapshots].reverse().map((snapshot) => {
                  const [year, month] = snapshot.month.split('-');
                  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', {
                    month: 'long',
                    year: 'numeric',
                  });
                  const isPositive = snapshot.balance.monthlyBalance >= 0;
                  return (
                    <div key={snapshot.month} className="history-month card">
                      <div className="history-month-header">
                        <span className="history-month-name">{monthName}</span>
                        <span
                          className={`history-month-balance ${isPositive ? 'value-green' : 'value-red'}`}
                        >
                          {formatCurrency(snapshot.balance.monthlyBalance)}
                        </span>
                      </div>
                      <div className="history-month-debt">
                        Dívidas: {formatCurrency(snapshot.balance.totalDebts)} ·{' '}
                        {HEALTH_LEVELS[snapshot.balance.healthLevel].emoji}{' '}
                        {HEALTH_LEVELS[snapshot.balance.healthLevel].label}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
};

export default SidePanel;
