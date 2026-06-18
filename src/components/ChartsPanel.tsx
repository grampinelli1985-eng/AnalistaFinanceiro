// ==========================================
// PAINEL DE GRÁFICOS
// ==========================================

import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import type { FinancialData, FinancialBalance, MonthlySnapshot } from '../types/financial';
import { formatCurrency } from '../utils/formatters';
import {
  calculateEmergencyFundGoal,
} from '../utils/financialCalculations';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler
);

interface ChartsPanelProps {
  financialData: FinancialData | null;
  balance: FinancialBalance | null;
  snapshots: MonthlySnapshot[];
}

// Opções compartilhadas de tema escuro
const darkTooltip = {
  backgroundColor: 'rgba(13, 21, 38, 0.95)',
  titleColor: '#f1f5f9',
  bodyColor: '#94a3b8',
  borderColor: 'rgba(99, 102, 241, 0.3)',
  borderWidth: 1,
  padding: 12,
  cornerRadius: 8,
};

const ChartsPanel: React.FC<ChartsPanelProps> = ({ financialData, balance, snapshots }) => {
  if (!financialData || !balance) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📊</div>
        <div className="empty-state-title">Gráficos indisponíveis</div>
        <p className="empty-state-text">
          Converse com o analista para gerar seu perfil financeiro. Os gráficos aparecerão aqui.
        </p>
      </div>
    );
  }

  const fixed = financialData.fixedExpenses || {};
  const variable = financialData.variableExpenses || {};
  const savings = financialData.savings || {};
  const currentSavingsAmount = savings.currentAmount || 0;

  // ── Dados para Gráfico de Pizza (Distribuição de Gastos) ──
  const expenseCategories = [
    { label: 'Aluguel/Financiamento', value: (fixed.rent || 0) },
    { label: 'Saúde', value: (fixed.healthPlan || 0) },
    { label: 'Internet/Tel/Stream', value: (fixed.internet || 0) + (fixed.phone || 0) + (fixed.streaming || 0) },
    { label: 'Outras Fixas', value: (fixed.vehicleLoan || 0) + (fixed.subscriptions || 0) + (fixed.other || 0) },
    { label: 'Alimentação', value: (variable.food || 0) + (variable.restaurants || 0) },
    { label: 'Transporte', value: (variable.transport || 0) },
    { label: 'Lazer/Compras', value: (variable.leisure || 0) + (variable.shopping || 0) },
    { label: 'Outras Variáveis', value: (variable.other || 0) },
    { label: 'Dívidas', value: (balance.totalDebtPayments || 0) },
  ].filter((c) => c.value > 0);

  const donutData = {
    labels: expenseCategories.map((c) => c.label),
    datasets: [
      {
        data: expenseCategories.map((c) => c.value),
        backgroundColor: [
          '#6366f1', '#818cf8', '#a5b4fc',
          '#10b981', '#34d399', '#6ee7b7',
          '#f97316', '#fbbf24', '#ef4444',
        ],
        borderColor: 'rgba(13, 21, 38, 0.8)',
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#94a3b8',
          font: { size: 11, family: 'Inter' },
          padding: 12,
          boxWidth: 10,
          boxHeight: 10,
        },
      },
      tooltip: {
        ...darkTooltip,
        callbacks: {
          label: (ctx: any) => {
            const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const pct = ((ctx.parsed / total) * 100).toFixed(1);
            return ` ${formatCurrency(ctx.parsed)} (${pct}%)`;
          },
        },
      },
    },
  };

  // ── Dados para Gráfico de Linha (Evolução da Dívida) ──
  const hasSnapshots = snapshots.length > 1;
  const lineLabels = hasSnapshots
    ? snapshots.map((s) => {
        const [year, month] = s.month.split('-');
        return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      })
    : ['Atual'];

  const lineDebtData = hasSnapshots
    ? snapshots.map((s) => s.balance.totalDebts)
    : [balance.totalDebts];

  const lineData = {
    labels: lineLabels,
    datasets: [
      {
        label: 'Total de Dívidas',
        data: lineDebtData,
        fill: true,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderColor: '#ef4444',
        borderWidth: 2,
        pointBackgroundColor: '#ef4444',
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.4,
      },
    ],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: '#64748b', font: { size: 10, family: 'Inter' } },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: {
          color: '#64748b',
          font: { size: 10, family: 'Inter' },
          callback: (value: any) => `R$ ${(value / 1000).toFixed(0)}k`,
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...darkTooltip,
        callbacks: {
          label: (ctx: any) => ` ${formatCurrency(ctx.parsed.y)}`,
        },
      },
    },
  };

  // ── Barra de Progresso — Reserva de Emergência ──
  const emergencyGoal = calculateEmergencyFundGoal(
    balance.totalFixedExpenses || 0,
    balance.totalVariableExpenses || 0,
    6
  );
  const emergencyProgress = emergencyGoal > 0
    ? Math.min(100, (currentSavingsAmount / emergencyGoal) * 100)
    : 0;

  const months3Goal = calculateEmergencyFundGoal(
    balance.totalFixedExpenses || 0,
    balance.totalVariableExpenses || 0,
    3
  );
  const months3Progress = months3Goal > 0
    ? Math.min(100, (currentSavingsAmount / months3Goal) * 100)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Distribuição de Gastos */}
      <div className="card">
        <div className="card-title">🥧 Distribuição de Gastos</div>
        <div className="chart-container" style={{ height: 220 }}>
          <Doughnut data={donutData} options={donutOptions} />
        </div>
      </div>

      {/* Reserva de Emergência */}
      <div className="card">
        <div className="card-title">🏦 Reserva de Emergência</div>

        <div className="progress-container">
          <div className="progress-header">
            <span className="progress-label">Meta: 3 meses</span>
            <span className="progress-value">{months3Progress.toFixed(0)}%</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${months3Progress}%` }}
            />
          </div>
          <div className="progress-subtext">
            {formatCurrency(currentSavingsAmount)} / {formatCurrency(months3Goal)}
          </div>
        </div>

        <div className="progress-container" style={{ marginTop: '12px' }}>
          <div className="progress-header">
            <span className="progress-label">Meta: 6 meses (ideal)</span>
            <span className="progress-value">{emergencyProgress.toFixed(0)}%</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${emergencyProgress}%` }}
            />
          </div>
          <div className="progress-subtext">
            {formatCurrency(currentSavingsAmount)} / {formatCurrency(emergencyGoal)}
            {emergencyProgress < 100 && (
              <span style={{ marginLeft: 4, color: 'var(--color-attention)' }}>
                — Faltam {formatCurrency(Math.max(0, emergencyGoal - currentSavingsAmount))}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Evolução da Dívida */}
      <div className="card">
        <div className="card-title">📉 Evolução da Dívida Total</div>
        {hasSnapshots ? (
          <div className="chart-container" style={{ height: 160 }}>
            <Line data={lineData} options={lineOptions} />
          </div>
        ) : (
          <div className="chart-placeholder">
            <span className="chart-placeholder-icon">📈</span>
            <span>Disponível após o 2º registro mensal</span>
          </div>
        )}
        <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          Dívida atual: <strong style={{ color: 'var(--color-critical)' }}>{formatCurrency(balance.totalDebts)}</strong>
        </div>
      </div>
    </div>
  );
};

export default ChartsPanel;
