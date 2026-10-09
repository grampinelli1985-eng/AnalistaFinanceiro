// ==========================================
// COMPARAÇÃO DE ESTRATÉGIAS DE QUITAÇÃO
// ==========================================
// Avalanche (maior juros primeiro) × Bola de Neve (menor saldo primeiro),
// usando a sobra mensal atual como valor extra para amortizar.
// ==========================================

import React, { useMemo } from 'react';
import type { Debt } from '../types/financial';
import { formatCurrency } from '../utils/formatters';
import { simulateAvalanchePayoff, simulateSnowballPayoff, type PayoffResult } from '../utils/financialCalculations';

interface DebtStrategyCardProps {
  debts: Debt[];
  monthlySurplus: number;
}

function formatDuration(result: PayoffResult): string {
  if (!result.paidOff) return 'mais de 30 anos';
  const years = Math.floor(result.months / 12);
  const months = result.months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`);
  if (months > 0) parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`);
  return parts.join(' e ') || 'menos de 1 mês';
}

const DebtStrategyCard: React.FC<DebtStrategyCardProps> = ({ debts, monthlySurplus }) => {
  const extra = Math.max(0, monthlySurplus);
  const { avalanche, snowball } = useMemo(() => ({
    avalanche: simulateAvalanchePayoff(debts, extra),
    snowball: simulateSnowballPayoff(debts, extra),
  }), [debts, extra]);

  if (debts.filter((d) => d.totalAmount > 0).length === 0) return null;

  const neitherPaysOff = !avalanche.paidOff && !snowball.paidOff;
  const interestSaved = snowball.totalInterestPaid - avalanche.totalInterestPaid;

  return (
    <div className="card">
      <div className="card-title">🧮 Estratégia de Quitação</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
        Simulação usando as parcelas atuais{extra > 0 ? ` + ${formatCurrency(extra)}/mês da sua sobra` : ''}.
      </div>

      {neitherPaysOff ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--color-critical)' }}>
          ⚠️ Com os valores atuais, as parcelas não cobrem os juros e as dívidas não terminam. É preciso renegociar ou aumentar o valor pago por mês.
        </div>
      ) : (
        <>
          <div className="summary-row">
            <span className="summary-row-label">🏔️ Avalanche (juros maiores primeiro)</span>
            <span className="summary-row-value">{formatDuration(avalanche)}</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '-4px 0 8px' }}>
            Juros pagos: {formatCurrency(avalanche.totalInterestPaid)}
          </div>
          <div className="summary-row">
            <span className="summary-row-label">⛄ Bola de Neve (menores saldos primeiro)</span>
            <span className="summary-row-value">{formatDuration(snowball)}</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '-4px 0 8px' }}>
            Juros pagos: {formatCurrency(snowball.totalInterestPaid)}
          </div>
          {interestSaved > 1 && (
            <div style={{ fontSize: '0.78rem', color: 'var(--color-healthy)' }}>
              A Avalanche economiza {formatCurrency(interestSaved)} em juros. A Bola de Neve dá vitórias mais rápidas, o que ajuda na motivação.
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DebtStrategyCard;
