// ==========================================
// APLICAÇÃO PRINCIPAL — ANALISTA FINANCEIRO IA
// Supabase Sync + Auth + Múltiplos Perfis
// ==========================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import './index.css';

// Componentes
import LoginScreen from './components/LoginScreen';
import ChatPanel from './components/ChatPanel';
import SidePanel from './components/SidePanel';
import ProfileSelectScreen from './components/ProfileSelectScreen';
import CreateProfileModal from './components/CreateProfileModal';
import FamilyViewPanel from './components/FamilyViewPanel';
import ProfileBadge from './components/ProfileBadge';
import LandingPage from './components/LandingPage';
import ConsentModal from './components/ConsentModal';
import SettingsModal from './components/SettingsModal';

// Serviços e Lib
import { supabase } from './lib/supabase';
import { sendMessage, OPENING_MESSAGE } from './services/aiService';
import {
  saveProfile,
  setActiveProfileId,
  loadProfiles,
  deleteProfile,
  loadFinancialData,
  loadChatHistory,
  loadMonthlySnapshots,
  saveFinancialData,
  saveChatHistory,
  saveMonthlySnapshot,
  clearProfileData,
  signOut,
  migrateLocalDataToSupabase,
  recoverOrphanedData,
  exportAllUserData,
  deleteAllUserData,
} from './services/storageService';

// Utilitários e Tipos
import { calculateFinancialBalance } from './utils/financialCalculations';
import { generateId, getCurrentMonthKey } from './utils/formatters';
import type {
  Message,
  FinancialData,
  FinancialBalance,
  MonthlySnapshot,
  Profile,
} from './types/financial';

// PDF
import jsPDF from 'jspdf';

// ── Tipos de tela ──────────────────────────
type AppView = 'landing' | 'login' | 'profile-select' | 'main-app' | 'family-view';

// ──────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ──────────────────────────────────────────────
const App: React.FC = () => {
  // ── Navegação e Autenticação ──────────────
  const [appView, setAppView] = useState<AppView>('landing');
  const [session, setSession] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const hasInitializedRef = useRef(false);
  const [needsConsent, setNeedsConsent] = useState(false);

  // ── Responsividade Mobile ──────────────────
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [mobileTab, setMobileTab] = useState<'chat' | 'dashboard'>('chat');

  // ── Perfis ────────────────────────────────
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // ── Estado do Chat (por perfil) ───────────
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);

  // ── Estado Financeiro (por perfil) ────────
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [balance, setBalance] = useState<FinancialBalance | null>(null);
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);

  // ── UI ────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // ── Toast ──────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Monitorar largura de tela para alternância mobile
  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleResize = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleResize);
    } else {
      mediaQuery.addListener(handleResize);
    }
    
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleResize);
      } else {
        mediaQuery.removeListener(handleResize);
      }
    };
  }, []);

  // ── Inicialização de Sessão ────────────────
  useEffect(() => {
    // Verificar sessão atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        initUserData();
      } else {
        setAppView('landing');
        setIsInitializing(false);
      }
    });

    // Escutar mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        initUserData();
      } else {
        setAppView('landing');
        setIsInitializing(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Inicialização Pós-Login ────────────────
  const initUserData = async () => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    setIsInitializing(true);
    let consented = false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        consented = !!(user.user_metadata?.accepted_terms_at && user.user_metadata?.accepted_privacy_at);
      }
    } catch (err) {
      console.error('Erro ao buscar usuário do Supabase:', err);
    }
    
    setNeedsConsent(!consented);

    // Tentar migrar dados antigos locais para o banco novo
    await migrateLocalDataToSupabase();
    await recoverOrphanedData();

    // Carregar perfis do Supabase
    const allProfiles = await loadProfiles();
    setProfiles(allProfiles);
    
    setAppView('profile-select');
    setIsInitializing(false);
  };

  // ── Selecionar Perfil (Carregamento Assíncrono) 
  const handleSelectProfile = useCallback(async (profile: Profile) => {
    setIsDataLoading(true);
    setActiveProfile(profile);
    setActiveProfileId(profile.id);

    try {
      // Carrega dados do perfil selecionado do Supabase
      const data = await loadFinancialData(profile.id);
      const msgs = await loadChatHistory(profile.id);
      const snaps = await loadMonthlySnapshots(profile.id);

      setFinancialData(data);
      setBalance(data ? calculateFinancialBalance(data) : null);
      setSnapshots(snaps);

      if (msgs.length > 0) {
        setMessages(msgs);
      } else {
        const openingMsg: Message = {
          id: generateId(),
          role: 'assistant',
          content: OPENING_MESSAGE,
          timestamp: new Date(),
        };
        setMessages([openingMsg]);
      }

      setAppView('main-app');
    } catch (err) {
      console.error('Erro ao selecionar perfil', err);
      showToast('Erro ao carregar dados do perfil.');
    } finally {
      setIsDataLoading(false);
    }
  }, [showToast]);

  // ── Criar / Editar Perfil ──────────────────
  const handleConfirmProfile = useCallback(async (profile: Profile) => {
    setIsDataLoading(true);
    try {
      const savedProfile = await saveProfile(profile);
      if (savedProfile) {
        const updatedProfiles = await loadProfiles();
        setProfiles(updatedProfiles);
        setShowCreateModal(false);
        setEditingProfile(null);
        showToast(`✅ Perfil "${savedProfile.name}" ${editingProfile ? 'atualizado' : 'criado'}!`);
      }
    } catch (e) {
      showToast('❌ Erro ao salvar perfil.');
    } finally {
      setIsDataLoading(false);
    }
  }, [editingProfile, showToast]);

  // ── Ações de Perfil ────────────────────────
  
  // Salvar novo perfil ou edição, trocar perfil e logout
  const handleSwitchProfile = useCallback(() => {
    setActiveProfile(null);
    setMessages([]);
    setFinancialData(null);
    setBalance(null);
    setSnapshots([]);
    setActiveProfileId(null);
    setAppView('profile-select');
  }, []);

  // ── Logout ───────────────────────────────
  const handleLogout = useCallback(async () => {
    setIsDataLoading(true);
    try {
      await signOut();
      hasInitializedRef.current = false;
      setSession(null);
      setAppView('landing');
    } catch (e) {
      console.error('Erro ao fazer logout', e);
    } finally {
      setIsDataLoading(false);
    }
  }, []);

  // ── Callbacks de Privacidade LGPD ─────────
  const handleAcceptConsent = useCallback(async () => {
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase.auth.updateUser({
        data: {
          accepted_terms_at: nowIso,
          accepted_privacy_at: nowIso
        }
      });
      if (error) throw error;
      setNeedsConsent(false);
      showToast('✅ Consentimento salvo com sucesso!');
    } catch (err) {
      console.error('Erro ao salvar consentimento:', err);
      showToast('❌ Erro ao salvar consentimento. Tente novamente.');
      throw err;
    }
  }, [showToast]);

  const handleExportUserData = useCallback(async () => {
    try {
      const data = await exportAllUserData();
      if (!data) {
        showToast('⚠️ Erro ao exportar dados: usuário não autenticado.');
        return;
      }
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `analista-financeiro-dados-${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('📥 Dados exportados com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar dados:', err);
      showToast('❌ Erro ao exportar dados.');
    }
  }, [showToast]);

  const handleDeleteAccountAndData = useCallback(async () => {
    try {
      const success = await deleteAllUserData();
      if (success) {
        showToast('🗑️ Todos os seus dados foram excluídos permanentemente.');
        await handleLogout();
      } else {
        showToast('❌ Erro ao excluir seus dados.');
      }
    } catch (err) {
      console.error('Erro ao deletar dados da conta:', err);
      showToast('❌ Erro ao processar exclusão de dados.');
    }
  }, [handleLogout, showToast]);

  // ── Enviar mensagem ao Gemini ──────────────
  const handleSendMessage = useCallback(async (content: string) => {
    if (isLoadingChat || !activeProfile) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    const typingMessage: Message = {
      id: 'typing',
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isTyping: true,
    };

    setMessages((prev) => [...prev, userMessage, typingMessage]);
    setIsLoadingChat(true);

    try {
      const allMessages = [...messages, userMessage];
      const response = await sendMessage(allMessages, financialData);

      // Detecta resposta vazia ou incompleta — o modelo às vezes termina o turno
      // sem gerar conteúdo visível (false completion). Nesse caso, enviamos uma
      // mensagem interna pedindo continuação, sem expor isso ao usuário.
      let finalContent = response.content;
      if (!finalContent || finalContent.trim().length < 10) {
        const followUpMessages = [...allMessages, {
          id: generateId(),
          role: 'assistant' as const,
          content: '',
          timestamp: new Date(),
        }, {
          id: generateId(),
          role: 'user' as const,
          content: 'Por favor, continue com o próximo passo da análise.',
          timestamp: new Date(),
        }];
        const retryResponse = await sendMessage(followUpMessages, financialData);
        finalContent = retryResponse.content || 'Desculpe, tive um problema ao gerar a resposta. Pode repetir sua última mensagem?';
        // Aproveita dados financeiros do retry se existirem
        if (!response.financialData && retryResponse.financialData) {
          response.financialData = retryResponse.financialData;
        }
      }

      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: finalContent,
        timestamp: new Date(),
      };

      setMessages((prev) => {
        const withoutTyping = prev.filter((m) => m.id !== 'typing');
        return [...withoutTyping, assistantMessage];
      });

      // Processa dados financeiros extraídos
      if (response.financialData) {
        try {
          const parsedData: FinancialData = JSON.parse(response.financialData);
          parsedData.lastUpdated = new Date().toISOString();

          setFinancialData(parsedData);
          const newBalance = calculateFinancialBalance(parsedData);
          setBalance(newBalance);

          // Salva no Supabase
          await saveFinancialData(activeProfile.id, parsedData);

          // Atualiza nome do perfil se a IA coletou
          if (parsedData.userName && parsedData.userName !== activeProfile.name) {
            const updatedProfile: Profile = { ...activeProfile, name: parsedData.userName };
            await saveProfile(updatedProfile);
            setActiveProfile(updatedProfile);
            setProfiles(await loadProfiles());
          }

          // Snapshot mensal
          const snapshot: MonthlySnapshot = {
            month: getCurrentMonthKey(),
            balance: newBalance,
            financialData: parsedData,
            notes: '',
          };
          await saveMonthlySnapshot(activeProfile.id, snapshot);
          setSnapshots((prev) => {
            const updated = prev.filter((s) => s.month !== snapshot.month);
            return [...updated, snapshot];
          });

          showToast('📊 Balanço financeiro atualizado!');
        } catch (e) {
          console.error('Erro ao parsear dados financeiros:', e);
        }
      }

      // Salva chat no Supabase
      const finalMessages = [...messages, userMessage, assistantMessage];
      await saveChatHistory(activeProfile.id, finalMessages);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Erro desconhecido.';
      
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: `⚠️ **Erro temporário ao processar sua mensagem.**\n\n${errMsg}\n\nIsso geralmente é passageiro — aguarde alguns segundos e tente enviar a mensagem novamente.`,
        timestamp: new Date(),
      };
      setMessages((prev) => {
        const withoutTyping = prev.filter((m) => m.id !== 'typing');
        return [...withoutTyping, errorMessage];
      });
    } finally {
      setIsLoadingChat(false);
    }
  }, [isLoadingChat, messages, financialData, activeProfile, showToast]);

  // ── Limpar Conversa ────────────────────────
  const handleClearChat = useCallback(async () => {
    if (!activeProfile) return;
    if (!window.confirm('Reiniciar conversa? O histórico será apagado, mas os dados financeiros são mantidos.')) return;
    
    setIsDataLoading(true);
    const openingMsg: Message = {
      id: generateId(),
      role: 'assistant',
      content: OPENING_MESSAGE,
      timestamp: new Date(),
    };
    setMessages([openingMsg]);
    await saveChatHistory(activeProfile.id, [openingMsg]);
    setIsDataLoading(false);
    showToast('💬 Conversa reiniciada.');
  }, [activeProfile, showToast]);

  // ── Forçar Sincronização do Painel ────────
  const handleSyncData = useCallback(async () => {
    if (!activeProfile || !financialData) {
      showToast('⚠️ Sem dados financeiros para sincronizar.');
      return;
    }
    try {
      showToast('🔄 Sincronizando painel...');

      // Recalcula o balanço localmente — sem chamar a IA.
      // Os dados financeiros já são atualizados automaticamente a cada
      // mensagem do chat; esse botão serve apenas para forçar um recálculo
      // caso o painel lateral tenha ficado desatualizado por algum motivo.
      financialData.lastUpdated = new Date().toISOString();
      const newBalance = calculateFinancialBalance(financialData);
      setBalance(newBalance);
      await saveFinancialData(activeProfile.id, financialData);

      const snapshot: MonthlySnapshot = {
        month: getCurrentMonthKey(),
        balance: newBalance,
        financialData,
        notes: '',
      };
      await saveMonthlySnapshot(activeProfile.id, snapshot);
      setSnapshots((prev) => {
        const updated = prev.filter((s) => s.month !== snapshot.month);
        return [...updated, snapshot];
      });

      showToast('✅ Painel sincronizado com sucesso!');
    } catch (e) {
      console.error(e);
      showToast('❌ Erro ao sincronizar o painel.');
    }
  }, [activeProfile, financialData, showToast]);

  // ── Resetar Dados do Perfil Atual ─────────
  const handleResetProfileData = useCallback(async () => {
    if (!activeProfile) return;
    if (!window.confirm(`Apagar TODOS os dados do perfil "${activeProfile.name}"? Esta ação não pode ser desfeita.`)) return;
    
    setIsDataLoading(true);
    await clearProfileData(activeProfile.id);
    
    setFinancialData(null);
    setBalance(null);
    setSnapshots([]);
    const openingMsg: Message = {
      id: generateId(),
      role: 'assistant',
      content: OPENING_MESSAGE,
      timestamp: new Date(),
    };
    setMessages([openingMsg]);
    await saveChatHistory(activeProfile.id, [openingMsg]);
    
    setIsDataLoading(false);
    showToast(`🗑️ Dados do perfil "${activeProfile.name}" apagados.`);
  }, [activeProfile, showToast]);

  // ── Excluir um Perfil Específico ───────────
  const handleDeleteProfile = useCallback(async (profile: Profile) => {
    if (profiles.length <= 1) {
      showToast('⚠️ Não é possível excluir o único perfil da conta. Use "Excluir Minha Conta" nas configurações de Privacidade para isso.');
      return;
    }

    setIsDataLoading(true);
    try {
      const success = await deleteProfile(profile.id);
      if (!success) {
        showToast('❌ Erro ao excluir o perfil. Tente novamente.');
        return;
      }

      const updatedProfiles = await loadProfiles();
      setProfiles(updatedProfiles);

      // Se o perfil excluído era o ativo, volta para a tela de seleção
      if (activeProfile?.id === profile.id) {
        setActiveProfile(null);
        setActiveProfileId(null);
        setFinancialData(null);
        setBalance(null);
        setSnapshots([]);
        setMessages([]);
        setAppView('profile-select');
      }

      showToast(`🗑️ Perfil "${profile.name}" excluído com sucesso.`);
    } catch (err) {
      console.error('Erro ao excluir perfil:', err);
      showToast('❌ Erro ao excluir o perfil.');
    } finally {
      setIsDataLoading(false);
    }
  }, [profiles, activeProfile, showToast]);

  // ── Exportar PDF ───────────────────────────
  const handleExportPDF = useCallback(async () => {
    if (!financialData || !balance || !activeProfile) {
      showToast('⚠️ Nenhum dado financeiro para exportar.');
      return;
    }
    showToast('📄 Gerando PDF...');

    try {
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
        pdf.text('Gerado pelo Analista Financeiro IA — Apenas para fins informativos e pessoais.', margin, pageHeight - 10);
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
          pdf.text('ANALISTA FINANCEIRO IA — DIAGNÓSTICO E PLANO DE AÇÃO', margin, 11);
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

      const fmtCurrency = (v: number) =>
        v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

      // Cabeçalho com cor do perfil
      const [r, g, b] = hexToRgb(activeProfile.color);
      pdf.setFillColor(r, g, b);
      pdf.rect(0, 0, pageWidth, 40, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('ANALISTA FINANCEIRO IA', margin, 17);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Relatório de ${activeProfile.avatar} ${financialData.userName || activeProfile.name}`, margin, 28);
      pdf.text(new Date().toLocaleDateString('pt-BR', { dateStyle: 'full' }), margin, 36);
      y = 50;

      // 1. Resumo do Balanço
      addLine('1. RESUMO DO BALANÇO FINANCEIRO', 14, true, [99, 102, 241], 4);
      addSep();
      addLine(`Receita Mensal Total: ${fmtCurrency(balance.totalIncome)}`, 11, false, [16, 185, 129]);
      addLine(`Despesas Fixas: ${fmtCurrency(balance.totalFixedExpenses)}`, 11);
      addLine(`Despesas Variáveis: ${fmtCurrency(balance.totalVariableExpenses)}`, 11);
      addLine(`Parcelas de Dívidas: ${fmtCurrency(balance.totalDebtPayments)}`, 11);
      addLine(`Total de Saídas: ${fmtCurrency(balance.totalExpenses)}`, 11, false, [239, 68, 68]);
      
      const { HEALTH_LEVELS } = await import('./types/financial');
      const health = HEALTH_LEVELS[balance.healthLevel];
      
      addLine(`SALDO MENSAL LÍQUIDO: ${fmtCurrency(balance.monthlyBalance)}`, 13, true,
        balance.monthlyBalance >= 0 ? [16, 185, 129] : [239, 68, 68], 5);
      y += 2;

      // 2. Detalhamento de Dívidas se houver
      if (financialData.debts.length > 0) {
        addLine('2. DETALHAMENTO DE DÍVIDAS ATIVAS', 14, true, [99, 102, 241], 4);
        addSep();
        financialData.debts.forEach((d) => {
          addLine(`• ${d.name}: Saldo devedor de ${fmtCurrency(d.totalAmount)} (Taxa de juros: ${d.monthlyInterestRate}%/mês, Parcela: ${fmtCurrency(d.monthlyPayment)})`, 10);
        });
        addLine(`TOTAL ACUMULADO EM DÍVIDAS: ${fmtCurrency(balance.totalDebts)}`, 11, true, [239, 68, 68], 5);
        y += 2;
      }

      // 3. Reservas
      addLine('3. RESERVA DE EMERGÊNCIA & METAS', 14, true, [99, 102, 241], 4);
      addSep();
      addLine(`Reserva financeira atual: ${fmtCurrency(financialData.savings.currentAmount)}`, 11);
      addLine(`Meses de cobertura: ${balance.savingsInMonths.toFixed(1)} meses de despesas (Meta recomendada: 6.0 meses)`, 11);
      addLine(`Índice de comprometimento de renda: ${balance.incomeCommitmentIndex}% (Limite máximo recomendado: 70%)`, 11, false,
        balance.incomeCommitmentIndex <= 70 ? [16, 185, 129] : [239, 68, 68], 5);
      y += 2;

      // 4. Análise de Saúde Financeira
      addLine('4. PARECER CRÍTICO E DIAGNÓSTICO', 14, true, [99, 102, 241], 4);
      addSep();
      addLine(`Diagnóstico Atual: ${health.emoji} ${health.label}`, 12, true, 
        balance.healthLevel === 'healthy' ? [16, 185, 129] : (balance.healthLevel === 'critical' ? [239, 68, 68] : [249, 115, 22]));
      addLine(health.description, 10.5, false, [100, 100, 100], 5);
      y += 1;

      // ── Análise Dinâmica de Prós & Contras ──
      const positivos: string[] = [];
      const negativos: string[] = [];

      if (balance.monthlyBalance > 0) {
        positivos.push(`Orçamento Superavitário: Você gasta menos do que ganha, tendo sobra de ${fmtCurrency(balance.monthlyBalance)}/mês.`);
      }
      if (financialData.savings.currentAmount > 0) {
        positivos.push(`Reserva Financeira: Você já acumulou ${fmtCurrency(financialData.savings.currentAmount)} de reserva.`);
      }
      if (balance.savingsInMonths >= 6) {
        positivos.push(`Proteção Completa: Sua reserva atual cobre ${balance.savingsInMonths.toFixed(1)} meses de custos de vida.`);
      }
      if (financialData.debts.length === 0) {
        positivos.push("Sem Endividamentos: Sem faturas atrasadas ou parcelas de empréstimo consumindo suas receitas.");
      }
      if (balance.incomeCommitmentIndex < 70) {
        positivos.push(`Boa Margem Livre: Apenas ${balance.incomeCommitmentIndex}% da renda está comprometida com obrigações.`);
      }

      if (balance.monthlyBalance <= 0) {
        negativos.push(`Orçamento em Déficit: Suas despesas excedem suas receitas em ${fmtCurrency(Math.abs(balance.monthlyBalance))}/mês.`);
      }
      if (financialData.debts.length > 0) {
        negativos.push(`Juros Financeiros: Possui ${financialData.debts.length} dívida(s) totalizando ${fmtCurrency(balance.totalDebts)}, sob efeito de juros.`);
      }
      if (balance.savingsInMonths < 6) {
        negativos.push(`Reserva Insuficiente: Reserva atual cobre apenas ${balance.savingsInMonths.toFixed(1)} meses de despesas.`);
      }
      if (balance.incomeCommitmentIndex >= 70) {
        negativos.push(`Renda Altamente Comprometida: Você gasta ${balance.incomeCommitmentIndex}% da renda fixa, reduzindo flexibilidade financeira.`);
      }
      const varPct = (balance.totalVariableExpenses / balance.totalIncome) * 100;
      if (varPct > 35) {
        negativos.push(`Gastos Supérfluos Elevados: Despesas variáveis consomem ${varPct.toFixed(0)}% da renda.`);
      }

      if (positivos.length > 0) {
        addLine('Pontos Fortes (Positivos):', 11.5, true, [16, 185, 129], 3);
        positivos.forEach(p => {
          addLine(`[SIM] ${p}`, 10, false, [30, 80, 50], 2);
        });
        y += 2;
      }

      if (negativos.length > 0) {
        addLine('Pontos de Atenção & Riscos (Negativos):', 11.5, true, [239, 68, 68], 3);
        negativos.forEach(n => {
          addLine(`[ALERTA] ${n}`, 10, false, [120, 30, 30], 2);
        });
        y += 2;
      }
      y += 2;

      // 5. Checklist do Plano de Ação
      addLine('5. CHECKLIST DO PLANO DE AÇÃO IMPRIMÍVEL', 14, true, [99, 102, 241], 4);
      addSep();

      const fase1: string[] = [];
      const fase2: string[] = [];
      const fase3: string[] = [];
      const fase4: string[] = [];

      // Ações Fase 1
      if (balance.monthlyBalance < balance.totalIncome * 0.15) {
        fase1.push("[ ] Cortar imediatamente assinaturas inativas, deliveries e compras impulsivas.");
      }
      fase1.push("[ ] Anotar detalhadamente 100% de todos os gastos diários nas próximas duas semanas.");
      fase1.push("[ ] Categorizar as despesas mensais entre essenciais e desejáveis.");

      // Ações Fase 2
      if (financialData.debts.length > 0) {
        fase2.push("[ ] Priorizar a quitação da dívida mais cara (Ex: Cartão de Crédito - Método Avalanche).");
        fase2.push("[ ] Ligar para credores e renegociar o valor total das pendências financeiras.");
        fase2.push("[ ] Direcionar 100% da sobra ou rendas extras exclusivamente para quitar as parcelas.");
      } else {
        fase2.push("[ ] Evitar parcelamentos ou novos endividamentos de qualquer tipo no cartão.");
      }

      // Ações Fase 3
      if (balance.savingsInMonths < 6) {
        const targetReserva = balance.totalExpenses * 6;
        fase3.push(`[ ] Poupar consistentemente até atingir a meta de ${fmtCurrency(targetReserva)} (6 meses de despesas).`);
        fase3.push("[ ] Guardar a reserva em um investimento seguro com liquidez diária (CDI 100% ou Tesouro Selic).");
      } else {
        fase3.push("[ ] Manter a reserva de emergência guardada e utilizá-la somente em casos de extrema necessidade.");
      }

      // Ações Fase 4
      if (financialData.debts.length === 0 && balance.savingsInMonths >= 6) {
        fase4.push("[ ] Estudar e definir os seus objetivos financeiros de médio e longo prazo.");
        fase4.push("[ ] Iniciar aportes em renda fixa ou variável adequados ao seu perfil de investidor.");
      } else {
        fase4.push("[ ] Adiar grandes aportes em investimentos de risco até quitar as dívidas e completar a reserva.");
      }

      const checklists = [
        { title: 'FASE 1 — Estabilização do Orçamento', items: fase1 },
        { title: 'FASE 2 — Quitação e Controle de Dívidas', items: fase2 },
        { title: 'FASE 3 — Formação da Reserva de Emergência', items: fase3 },
        { title: 'FASE 4 — Investimentos & Planejamento Futuro', items: fase4 }
      ];

      checklists.forEach(c => {
        addLine(c.title.toUpperCase(), 11, true, [99, 102, 241], 2);
        c.items.forEach(item => {
          addLine(item, 10, false, [50, 50, 50], 1.5);
        });
        y += 3;
      });

      drawFooter(currentPage);

      pdf.save(`relatorio-${(financialData.userName || activeProfile.name).replace(/\s/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`);
      showToast('✅ PDF exportado!');
    } catch (err) {
      console.error(err);
      showToast('❌ Erro ao gerar PDF.');
    }
  }, [financialData, balance, activeProfile, showToast]);

  // ── Loading Screen ──────────────────────────
  if (isInitializing) {
    return (
      <div className="profile-select-screen" style={{ justifyContent: 'center' }}>
        <div className="profile-bg-orb profile-bg-orb-1" />
        <div style={{ textAlign: 'center', zIndex: 1 }}>
          <div className="profile-select-logo" style={{ margin: '0 auto 24px', animation: 'logoGlow 1s ease-in-out infinite alternate' }}>🤖</div>
          <h2 style={{ color: 'var(--color-text-primary)' }}>Conectando...</h2>
        </div>
      </div>
    );
  }

  // ── Render: Landing / Login ─────────────────
  if (!session) {
    if (appView === 'landing') {
      return <LandingPage onLoginClick={() => setAppView('login')} />;
    }
    return <LoginScreen onLoginSuccess={() => {}} />;
  }

  // Se o usuário está logado mas precisa dar o consentimento da LGPD
  if (needsConsent) {
    return (
      <ConsentModal
        onAcceptConsent={handleAcceptConsent}
        onLogout={handleLogout}
      />
    );
  }

  // Visão familiar: quais perfis autorizaram
  const familyEligibleCount = profiles.filter((p) => p.allowFamilyView).length;

  // ── Render Principal ────────────────────────
  return (
    <div className="app-container">
      {/* Overlay de carregamento ao trocar perfis / salvar coisas do Supabase */}
      {isDataLoading && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(7, 13, 26, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="profile-select-logo" style={{ width: 48, height: 48, fontSize: 24, animation: 'logoGlow 0.5s ease-in-out infinite alternate' }}>⏳</div>
        </div>
      )}

      {/* Modal Criar/Editar Perfil */}
      {showCreateModal && (
        <CreateProfileModal
          existingProfile={editingProfile}
          onConfirm={handleConfirmProfile}
          onCancel={() => { setShowCreateModal(false); setEditingProfile(null); }}
        />
      )}

      {/* Modal de Configurações (Visão Familiar + Privacidade/LGPD) */}
      {showSettingsModal && (
        <SettingsModal
          profiles={profiles}
          onUpdateProfile={async (profile) => {
            await saveProfile(profile);
            const updatedProfiles = await loadProfiles();
            setProfiles(updatedProfiles);
          }}
          onDeleteProfile={handleDeleteProfile}
          onClose={() => setShowSettingsModal(false)}
          onExportData={handleExportUserData}
          onDeleteAccountAndData={handleDeleteAccountAndData}
        />
      )}

      {/* Visão Familiar */}
      {appView === 'family-view' && (
        <FamilyViewPanel
          profiles={profiles}
          onClose={() => setAppView('profile-select')}
        />
      )}

      {/* ── TELA DE SELEÇÃO DE PERFIS ── */}
      {appView === 'profile-select' && (
        <>
          {/* Botão de Logout superior direito na tela de seleção */}
          <button 
            onClick={handleLogout}
            style={{ position: 'absolute', top: 24, right: 24, zIndex: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-full)', padding: '8px 16px', color: 'var(--color-text-secondary)', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.color = 'var(--color-critical)'}
            onMouseOut={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
          >
            Sair da conta
          </button>

          <ProfileSelectScreen
            profiles={profiles}
            onSelectProfile={handleSelectProfile}
            onAddProfile={() => { setEditingProfile(null); setShowCreateModal(true); }}
            onOpenFamilyView={() => setAppView('family-view')}
            canShowFamilyView={familyEligibleCount >= 2}
          />
        </>
      )}

      {/* ── APP PRINCIPAL ── */}
      {appView === 'main-app' && activeProfile && (
        <>
          {/* Header */}
          <header className="app-header">
            <div className="header-brand">
              <div className="header-logo">🤖</div>
              <div>
                <div className="header-title">Analista Financeiro IA</div>
                <div className="header-subtitle">Diagnóstico financeiro honesto e orientado a resultados</div>
              </div>
            </div>

            <div className="header-actions">
              {financialData && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginRight: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-green)', display: 'inline-block' }} />
                  Nuvem Supabase
                </span>
              )}

              {/* Botão de Configurações */}
              <button
                onClick={() => setShowSettingsModal(true)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-full)',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  marginRight: 8,
                }}
                aria-label="Abrir configurações"
                title="Configurações"
              >
                ⚙️
              </button>

              {/* Badge do perfil ativo */}
              <ProfileBadge profile={activeProfile} onClick={handleSwitchProfile} />
            </div>
          </header>

          {/* Mobile Tabs Switcher */}
          <div className="mobile-nav-tabs" role="tablist">
            <button
              className={`mobile-nav-tab ${mobileTab === 'chat' ? 'active' : ''}`}
              onClick={() => setMobileTab('chat')}
              role="tab"
              aria-selected={mobileTab === 'chat'}
            >
              💬 Conversa
            </button>
            <button
              className={`mobile-nav-tab ${mobileTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setMobileTab('dashboard')}
              role="tab"
              aria-selected={mobileTab === 'dashboard'}
            >
              📊 Diagnóstico
            </button>
          </div>

          {/* Conteúdo Principal */}
          <main className="app-main">
            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoadingChat}
              onClearChat={handleClearChat}
              onResetData={handleResetProfileData}
              className={isMobile && mobileTab !== 'chat' ? 'mobile-hidden' : ''}
            />
            <SidePanel
              financialData={financialData}
              balance={balance}
              snapshots={snapshots}
              onExportPDF={handleExportPDF}
              onResetData={handleResetProfileData}
              onSyncData={handleSyncData}
              className={isMobile && mobileTab !== 'dashboard' ? 'mobile-hidden' : ''}
            />
          </main>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast" role="status" aria-live="polite">{toast}</div>
      )}
    </div>
  );
};

// Utilidade: converte hex para RGB
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [99, 102, 241];
}

export default App;
