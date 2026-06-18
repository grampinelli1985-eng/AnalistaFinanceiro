// ==========================================
// PAINEL DE VISÃO FAMILIAR CONSOLIDADA
// ==========================================

import React, { useMemo, useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { Profile, FamilyBalance, FinancialData, FinancialBalance } from '../types/financial';
import { HEALTH_LEVELS } from '../types/financial';
import { formatCurrency } from '../utils/formatters';
import { calculateFinancialBalance } from '../utils/financialCalculations';
import { loadFinancialData } from '../services/storageService';
import jsPDF from 'jspdf';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface FamilyViewPanelProps {
  profiles: Profile[];
  onClose: () => void;
}

const darkTooltip = {
  backgroundColor: 'rgba(13, 21, 38, 0.95)',
  titleColor: '#f1f5f9',
  bodyColor: '#94a3b8',
  borderColor: 'rgba(99, 102, 241, 0.3)',
  borderWidth: 1,
  padding: 12,
  cornerRadius: 8,
};

const FamilyViewPanel: React.FC<FamilyViewPanelProps> = ({ profiles, onClose }) => {
  const [breakdowns, setBreakdowns] = useState<{ profile: Profile; data: FinancialData; balance: FinancialBalance }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtra apenas perfis que autorizaram a visão familiar e têm dados financeiros
  const participatingProfiles = useMemo(
    () => profiles.filter((p) => p.allowFamilyView),
    [profiles]
  );

  // Carrega dados assíncronos do Supabase
  useEffect(() => {
    let isMounted = true;
    
    async function fetchFamilyData() {
      setIsLoading(true);
      try {
        const results = await Promise.all(
          participatingProfiles.map(async (profile) => {
            const data = await loadFinancialData(profile.id);
            const balance = data ? calculateFinancialBalance(data) : null;
            return { profile, data, balance };
          })
        );
        
        if (isMounted) {
          const validBreakdowns = results.filter((b): b is { profile: Profile; data: FinancialData; balance: FinancialBalance } =>
            b.data !== null && b.balance !== null
          );
          setBreakdowns(validBreakdowns);
        }
      } catch (err) {
        console.error('Erro ao carregar dados familiares do Supabase:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (participatingProfiles.length >= 2) {
      fetchFamilyData();
    } else {
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [participatingProfiles]);

  // Calcula balanço familiar consolidado
  const familyBalance = useMemo((): FamilyBalance | null => {
    if (breakdowns.length === 0) return null;

    const totalFamilyIncome = breakdowns.reduce((s, b) => s + b.balance.totalIncome, 0);
    const totalFamilyFixedExpenses = breakdowns.reduce((s, b) => s + b.balance.totalFixedExpenses, 0);
    const totalFamilyVariableExpenses = breakdowns.reduce((s, b) => s + b.balance.totalVariableExpenses, 0);
    const totalFamilyDebtPayments = breakdowns.reduce((s, b) => s + b.balance.totalDebtPayments, 0);
    const totalFamilyExpenses = breakdowns.reduce((s, b) => s + b.balance.totalExpenses, 0);
    const totalFamilyDebts = breakdowns.reduce((s, b) => s + b.balance.totalDebts, 0);
    const totalFamilySavings = breakdowns.reduce((s, b) => s + b.data.savings.currentAmount, 0);

    return {
      totalFamilyIncome,
      totalFamilyFixedExpenses,
      totalFamilyVariableExpenses,
      totalFamilyDebtPayments,
      totalFamilyExpenses,
      totalFamilyBalance: totalFamilyIncome - totalFamilyExpenses,
      totalFamilyDebts,
      totalFamilySavings,
      profileBreakdowns: breakdowns.map((b) => ({
        profile: b.profile,
        balance: b.balance,
        financialData: b.data,
      })),
    };
  }, [breakdowns]);

  // Gráfico comparativo de barras
  const barData = useMemo(() => ({
    labels: breakdowns.map((b) => b.profile.name),
    datasets: [
      {
        label: 'Renda',
        data: breakdowns.map((b) => b.balance.totalIncome),
        backgroundColor: breakdowns.map((b) => `${b.profile.color}cc`),
        borderColor: breakdowns.map((b) => b.profile.color),
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: 'Despesas',
        data: breakdowns.map((b) => b.balance.totalExpenses),
        backgroundColor: breakdowns.map(() => 'rgba(239, 68, 68, 0.5)'),
        borderColor: breakdowns.map(() => '#ef4444'),
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  }), [breakdowns]);

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#94a3b8', font: { size: 11, family: 'Inter' } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: '#94a3b8',
          font: { size: 10, family: 'Inter' },
          callback: (v: any) => `R$ ${(v / 1000).toFixed(0)}k`,
        },
      },
    },
    plugins: {
      legend: {
        labels: { color: '#94a3b8', font: { size: 11, family: 'Inter' }, boxWidth: 12 },
      },
      tooltip: {
        ...darkTooltip,
        callbacks: { label: (ctx: any) => ` ${formatCurrency(ctx.parsed.y)}` },
      },
    },
  };

  // Exportar PDF familiar
  const handleExportPDF = () => {
    if (!familyBalance) return;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    let y = margin;
    let currentPage = 1;

    const drawFooter = (pageNum: number) => {
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Gerado pelo Analista Financeiro IA — Diagnóstico Familiar e Planejamento Conjunto.', margin, pageHeight - 10);
      pdf.text(`Página ${pageNum}`, pageWidth - margin - 15, pageHeight - 10);
    };

    const checkPageOverflow = (heightNeeded: number) => {
      if (y + heightNeeded > pageHeight - 18) {
        drawFooter(currentPage);
        pdf.addPage();
        currentPage++;
        // Cabeçalho de páginas subsequentes
        pdf.setDrawColor(220, 224, 230);
        pdf.line(margin, 15, pageWidth - margin, 15);
        pdf.setFontSize(8);
        pdf.setTextColor(120, 120, 120);
        pdf.setFont('helvetica', 'normal');
        pdf.text('RELATÓRIO FAMILIAR CONSOLIDADO — ANALISTA FINANCEIRO IA', margin, 11);
        y = 24;
      }
    };

    const addLine = (text: string, fontSize = 11, bold = false, color?: [number, number, number], spacingAfter = 3) => {
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', bold ? 'bold' : 'normal');
      if (color) pdf.setTextColor(...color);
      else pdf.setTextColor(30, 30, 30);
      
      const lines: string[] = pdf.splitTextToSize(text, pageWidth - margin * 2);
      const lineHeight = fontSize * 0.35 + 2.5;
      
      lines.forEach(line => {
        checkPageOverflow(lineHeight);
        pdf.text(line, margin, y);
        y += lineHeight;
      });
      y += spacingAfter;
    };

    const addSep = () => {
      checkPageOverflow(5);
      pdf.setDrawColor(220, 224, 230);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 6;
    };

    // Cabeçalho
    pdf.setFillColor(99, 102, 241);
    pdf.rect(0, 0, pageWidth, 40, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RELATÓRIO FAMILIAR CONSOLIDADO', margin, 17);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(
      `Perfis Integrados: ${familyBalance.profileBreakdowns.map((b) => b.profile.name).join(', ')}`,
      margin, 28
    );
    pdf.text(new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' }), margin, 36);
    y = 50;

    // 1. Consolidado Familiar
    addLine('1. BALANÇO FAMILIAR CONSOLIDADO', 14, true, [99, 102, 241], 4);
    addSep();
    addLine(`Renda Familiar Total: ${formatCurrency(familyBalance.totalFamilyIncome)}`, 11, false, [16, 185, 129]);
    addLine(`Despesas Totais: ${formatCurrency(familyBalance.totalFamilyExpenses)}`, 11, false, [239, 68, 68]);
    addLine(
      `Saldo Familiar Consolidado: ${formatCurrency(familyBalance.totalFamilyBalance)}`,
      13, true,
      familyBalance.totalFamilyBalance >= 0 ? [16, 185, 129] : [239, 68, 68], 5
    );
    addLine(`Dívidas Totais Acumuladas: ${formatCurrency(familyBalance.totalFamilyDebts)}`, 11, false, [239, 68, 68]);
    addLine(`Reservas Acumuladas: ${formatCurrency(familyBalance.totalFamilySavings)}`, 11, false, [16, 185, 129], 5);
    y += 2;

    // 2. Por perfil
    addLine('2. DETALHAMENTO INDIVIDUAL POR PERFIL', 14, true, [99, 102, 241], 4);
    addSep();
    familyBalance.profileBreakdowns.forEach((b) => {
      addLine(`${b.profile.avatar} ${b.profile.name} (Diagnóstico: ${HEALTH_LEVELS[b.balance.healthLevel].label})`, 12, true, [99, 102, 241], 2);
      addLine(`• Renda: ${formatCurrency(b.balance.totalIncome)} | Despesas: ${formatCurrency(b.balance.totalExpenses)}`, 10, false, [60, 60, 60], 1.5);
      addLine(`• Saldo Mensal: ${formatCurrency(b.balance.monthlyBalance)} | Dívidas: ${formatCurrency(b.balance.totalDebts)}`, 10, false, [60, 60, 60], 1.5);
      addLine(`• Reservas: ${formatCurrency(b.financialData.savings.currentAmount)} (${b.balance.savingsInMonths.toFixed(1)} meses de cobertura)`, 10, false, [60, 60, 60], 4);
    });
    y += 2;

    // 3. Diagnóstico e Análise Familiar
    addLine('3. DIAGNÓSTICO DO ORÇAMENTO FAMILIAR', 14, true, [99, 102, 241], 4);
    addSep();

    // ── Análise Dinâmica Familiar ──
    const positivos: string[] = [];
    const negativos: string[] = [];
    const checklist: string[] = [];

    if (familyBalance.totalFamilyBalance > 0) {
      positivos.push(`Orçamento Consolidado Positivo: A família unida gera um superávit mensal de ${formatCurrency(familyBalance.totalFamilyBalance)}.`);
    }
    if (familyBalance.totalFamilySavings > 0) {
      positivos.push(`Colchão Financeiro Consolidado: As reservas da família somam ${formatCurrency(familyBalance.totalFamilySavings)}.`);
    }
    const debtFreeCount = familyBalance.profileBreakdowns.filter(b => b.balance.totalDebts === 0).length;
    if (debtFreeCount > 0) {
      positivos.push(`Membros Livres de Dívidas: ${debtFreeCount} de seus familiares não possuem dívidas ativas.`);
    }
    const positiveCount = familyBalance.profileBreakdowns.filter(b => b.balance.monthlyBalance > 0).length;
    if (positiveCount === familyBalance.profileBreakdowns.length) {
      positivos.push("Equilíbrio Familiar Geral: Todos os membros possuem saldo mensal individual positivo.");
    }

    if (familyBalance.totalFamilyBalance <= 0) {
      negativos.push(`Déficit Consolidado: O orçamento familiar opera em déficit de ${formatCurrency(Math.abs(familyBalance.totalFamilyBalance))} mensais.`);
    }
    if (familyBalance.totalFamilyDebts > 0) {
      negativos.push(`Endividamento Acumulado: O total consolidado em dívidas na família é de ${formatCurrency(familyBalance.totalFamilyDebts)}.`);
    }
    const inDebtCount = familyBalance.profileBreakdowns.filter(b => b.balance.totalDebts > 0).length;
    if (inDebtCount > 0) {
      negativos.push(`Endividamento Individual: ${inDebtCount} membro(s) da família possui(em) dívidas sob efeito de juros.`);
    }
    const combinedExpenses = familyBalance.totalFamilyExpenses;
    const combinedSavings = familyBalance.totalFamilySavings;
    const combinedSavingsMonths = combinedExpenses > 0 ? (combinedSavings / combinedExpenses) : 0;
    if (combinedSavingsMonths < 6) {
      negativos.push(`Reserva Familiar Baixa: O colchão financeiro consolidado cobre apenas ${combinedSavingsMonths.toFixed(1)} meses de despesas da família.`);
    }

    checklist.push("[ ] Realizar uma reunião familiar mensal para alinhar o orçamento e definir metas conjuntas.");
    if (familyBalance.totalFamilyDebts > 0) {
      checklist.push("[ ] Criar um fundo comum ou definir estratégias de ajuda mútua para quitação das dívidas mais caras.");
    }
    if (combinedSavingsMonths < 6) {
      const targetSavings = combinedExpenses * 6;
      checklist.push(`[ ] Definir uma meta conjunta para elevar as reservas familiares para ${formatCurrency(targetSavings)} (6 meses de despesas).`);
    }
    checklist.push("[ ] Revisar gastos supérfluos da residência (energia, internet, assinaturas duplicadas) para reduzir saídas fixas.");
    checklist.push("[ ] Apoiar os membros em déficit a mapearem despesas e buscarem estabilização imediata.");

    if (positivos.length > 0) {
      addLine('Pontos Fortes da Família:', 11.5, true, [16, 185, 129], 3);
      positivos.forEach(p => addLine(`[SIM] ${p}`, 10, false, [30, 80, 50], 2));
      y += 2;
    }

    if (negativos.length > 0) {
      addLine('Pontos de Atenção & Riscos da Família:', 11.5, true, [239, 68, 68], 3);
      negativos.forEach(n => addLine(`[ALERTA] ${n}`, 10, false, [120, 30, 30], 2));
      y += 2;
    }
    y += 2;

    // 4. Checklist Familiar
    addLine('4. CHECKLIST DO PLANEJAMENTO FAMILIAR IMPRIMÍVEL', 14, true, [99, 102, 241], 4);
    addSep();
    checklist.forEach(item => {
      addLine(item, 10, false, [50, 50, 50], 1.5);
    });

    drawFooter(currentPage);

    pdf.save(`relatorio-familiar-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (participatingProfiles.length < 2) {
    return (
      <div className="modal-overlay">
        <div className="modal-box">
          <div className="modal-icon">👨‍👩‍👧</div>
          <h2 className="modal-title">Visão Familiar</h2>
          <p className="modal-description">
            Para ativar a visão familiar, pelo menos <strong>2 perfis</strong> precisam autorizar
            a visibilidade mútua. Edite os perfis desejados e ative a opção
            <strong> "Autorizar Visão Familiar"</strong>.
          </p>
          <div className="modal-actions">
            <button className="btn btn-primary w-full" onClick={onClose}>Entendido</button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="modal-overlay">
        <div className="modal-box" style={{ textAlign: 'center' }}>
          <div className="profile-select-logo" style={{ margin: '0 auto 24px', animation: 'logoGlow 1s ease-in-out infinite alternate', width: 48, height: 48, fontSize: 24 }}>⏳</div>
          <h2 className="modal-title">Sincronizando Nuvem...</h2>
          <p className="modal-description">Buscando dados financeiros do Supabase.</p>
        </div>
      </div>
    );
  }

  if (!familyBalance || breakdowns.length < 2) {
    return (
      <div className="modal-overlay">
        <div className="modal-box">
          <div className="modal-icon">📊</div>
          <h2 className="modal-title">Dados Insuficientes</h2>
          <p className="modal-description">
            Os perfis que autorizaram a visão familiar ainda não concluíram o onboarding financeiro.
            Converse com o analista em cada perfil para gerar os dados necessários.
          </p>
          <div className="modal-actions">
            <button className="btn btn-primary w-full" onClick={onClose}>Voltar</button>
          </div>
        </div>
      </div>
    );
  }

  const isPositive = familyBalance.totalFamilyBalance >= 0;

  return (
    <div className="modal-overlay family-view-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="family-view-panel" role="dialog" aria-labelledby="family-view-title">
        {/* Cabeçalho */}
        <div className="family-view-header">
          <div>
            <h2 id="family-view-title" className="family-view-title">
              👨‍👩‍👧 Visão Familiar
            </h2>
            <p className="family-view-subtitle">
              Consolidado de: {familyBalance.profileBreakdowns.map((b) => b.profile.name).join(', ')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={handleExportPDF}>
              📄 PDF Familiar
            </button>
            <button
              id="close-family-view-btn"
              className="btn btn-ghost btn-sm btn-icon"
              onClick={onClose}
              aria-label="Fechar visão familiar"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="family-view-content">
          {/* Saldo familiar em destaque */}
          <div className={`balance-highlight ${isPositive ? 'positive' : 'negative'}`} style={{ marginBottom: 0 }}>
            <div className="balance-highlight-label">Saldo Familiar Mensal</div>
            <div className={`balance-highlight-value ${isPositive ? 'value-green' : 'value-red'}`}>
              {formatCurrency(familyBalance.totalFamilyBalance)}
            </div>
          </div>

          {/* Cards de métricas */}
          <div className="family-metrics-grid">
            <div className="family-metric-card">
              <span className="family-metric-label">💰 Renda Total</span>
              <span className="family-metric-value value-green">
                {formatCurrency(familyBalance.totalFamilyIncome)}
              </span>
            </div>
            <div className="family-metric-card">
              <span className="family-metric-label">🔴 Despesas Totais</span>
              <span className="family-metric-value value-red">
                {formatCurrency(familyBalance.totalFamilyExpenses)}
              </span>
            </div>
            <div className="family-metric-card">
              <span className="family-metric-label">💳 Dívidas Totais</span>
              <span className="family-metric-value value-red">
                {formatCurrency(familyBalance.totalFamilyDebts)}
              </span>
            </div>
            <div className="family-metric-card">
              <span className="family-metric-label">🏦 Reservas Totais</span>
              <span className="family-metric-value value-green">
                {formatCurrency(familyBalance.totalFamilySavings)}
              </span>
            </div>
          </div>

          {/* Gráfico comparativo */}
          <div className="card">
            <div className="card-title">📊 Comparativo por Perfil</div>
            <div style={{ height: 200 }}>
              <Bar data={barData} options={barOptions} />
            </div>
          </div>

          {/* Tabela de detalhamento */}
          <div className="card">
            <div className="card-title">📋 Detalhamento por Perfil</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Perfil</th>
                    <th style={{ textAlign: 'right', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Renda</th>
                    <th style={{ textAlign: 'right', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Despesas</th>
                    <th style={{ textAlign: 'right', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Saldo</th>
                    <th style={{ textAlign: 'right', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Dívidas</th>
                    <th style={{ textAlign: 'center', padding: '8px', color: 'var(--color-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--color-border)' }}>Saúde</th>
                  </tr>
                </thead>
                <tbody>
                  {familyBalance.profileBreakdowns.map((breakdown) => (
                    <tr key={breakdown.profile.id}>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--color-border-light)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: 8,
                            background: `${breakdown.profile.color}22`,
                            border: `1.5px solid ${breakdown.profile.color}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, flexShrink: 0,
                          }}>
                            {breakdown.profile.avatar}
                          </div>
                          <span style={{ fontWeight: 500 }}>{breakdown.profile.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: 'var(--color-green)', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--color-border-light)' }}>
                        {formatCurrency(breakdown.balance.totalIncome)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: 'var(--color-critical)', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--color-border-light)' }}>
                        {formatCurrency(breakdown.balance.totalExpenses)}
                      </td>
                      <td style={{
                        padding: '8px', textAlign: 'right', fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        color: breakdown.balance.monthlyBalance >= 0 ? 'var(--color-green)' : 'var(--color-critical)',
                        borderBottom: '1px solid var(--color-border-light)',
                      }}>
                        {formatCurrency(breakdown.balance.monthlyBalance)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', color: 'var(--color-critical)', fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid var(--color-border-light)' }}>
                        {formatCurrency(breakdown.balance.totalDebts)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', borderBottom: '1px solid var(--color-border-light)' }}>
                        <span className={`health-badge ${breakdown.balance.healthLevel}`} style={{ display: 'inline-flex', padding: '2px 8px', fontSize: '0.7rem' }}>
                          {HEALTH_LEVELS[breakdown.balance.healthLevel].emoji} {HEALTH_LEVELS[breakdown.balance.healthLevel].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {/* Linha de totais */}
                  <tr style={{ background: 'rgba(99, 102, 241, 0.05)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 700 }}>TOTAL FAMILIAR</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--color-green)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(familyBalance.totalFamilyIncome)}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--color-critical)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(familyBalance.totalFamilyExpenses)}
                    </td>
                    <td style={{
                      padding: '10px 8px', textAlign: 'right', fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: isPositive ? 'var(--color-green)' : 'var(--color-critical)',
                    }}>
                      {formatCurrency(familyBalance.totalFamilyBalance)}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--color-critical)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(familyBalance.totalFamilyDebts)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
            ℹ️ A visão familiar é somente leitura. Cada perfil é gerenciado individualmente pela IA.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FamilyViewPanel;
