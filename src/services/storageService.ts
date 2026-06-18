// ==========================================
// SERVIÇO DE PERSISTÊNCIA — SUPABASE
// ==========================================
// Dados armazenados em tabelas no Supabase via RLS.
// ==========================================

import { supabase } from '../lib/supabase';
import type {
  Profile,
  FinancialData,
  Message,
  MonthlySnapshot,
  FamilyViewConfig,
} from '../types/financial';

const PROFILES_STORAGE = 'analista_financeiro_profiles';
const ACTIVE_PROFILE_STORAGE = 'analista_financeiro_active_profile';

// ── Obter Sessão Atual ────────────────────
async function getUserId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

// ── Perfis (Tabela: profiles) ─────────────

export async function loadProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erro ao carregar perfis:', error);
    return [];
  }

  return data.map((p) => ({
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    color: p.color,
    createdAt: p.created_at,
    allowFamilyView: p.allow_family_view,
  }));
}

export async function saveProfile(profile: Partial<Profile> & { id?: string }): Promise<Profile | null> {
  const userId = await getUserId();
  if (!userId) return null;

  const payload = {
    account_id: userId,
    name: profile.name,
    avatar: profile.avatar,
    color: profile.color,
    allow_family_view: profile.allowFamilyView,
  };

  if (profile.id && profile.id.includes('-')) {
    // Update (Supabase UUIDs têm hífens. Se não tem hífen, é legado local).
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', profile.id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar perfil:', error);
      return null;
    }
    return {
      id: data.id,
      name: data.name,
      avatar: data.avatar,
      color: data.color,
      createdAt: data.created_at,
      allowFamilyView: data.allow_family_view,
    };
  } else {
    // Insert
    const { data, error } = await supabase
      .from('profiles')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar perfil:', error);
      return null;
    }
    return {
      id: data.id,
      name: data.name,
      avatar: data.avatar,
      color: data.color,
      createdAt: data.created_at,
      allowFamilyView: data.allow_family_view,
    };
  }
}

export async function deleteProfile(profileId: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', profileId);

  if (error) {
    console.error('Erro ao deletar perfil:', error);
    return false;
  }
  return true;
}

// ── Perfil Ativo Local ────────────────────
const ACTIVE_PROFILE_KEY = 'af_active_profile_id';

export function setActiveProfileId(profileId: string | null): void {
  if (profileId) localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
  else localStorage.removeItem(ACTIVE_PROFILE_KEY);
}

export function loadActiveProfileId(): string | null {
  return localStorage.getItem(ACTIVE_PROFILE_KEY);
}

// ── Dados Financeiros (financial_data) ────

export async function loadFinancialData(profileId: string): Promise<FinancialData | null> {
  const { data, error } = await supabase
    .from('financial_data')
    .select('data')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error || !data) return null;
  return data.data as FinancialData;
}

export async function saveFinancialData(profileId: string, financialData: FinancialData): Promise<void> {
  // Tenta atualizar primeiro
  const { data } = await supabase
    .from('financial_data')
    .select('data')
    .eq('profile_id', profileId)
    .limit(1);

  if (data && data.length > 0) {
    // Update
    await supabase
      .from('financial_data')
      .update({ data: financialData, updated_at: new Date().toISOString() })
      .eq('profile_id', profileId);
  } else {
    // Insert
    await supabase
      .from('financial_data')
      .insert([{ profile_id: profileId, data: financialData }]);
  }
}

// ── Histórico de Chat (chat_history) ──────

export async function loadChatHistory(profileId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('chat_history')
    .select('messages')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error || !data || !data.messages) return [];

  // Converte string de data de volta para objeto Date
  return (data.messages as any[]).map((m: any) => ({
    ...m,
    timestamp: new Date(m.timestamp),
  }));
}

export async function saveChatHistory(profileId: string, messages: Message[]): Promise<void> {
  const toSave = messages.slice(-100); // Limita tamanho

  const { data } = await supabase
    .from('chat_history')
    .select('id')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (data) {
    await supabase
      .from('chat_history')
      .update({ messages: toSave, updated_at: new Date().toISOString() })
      .eq('profile_id', profileId);
  } else {
    await supabase
      .from('chat_history')
      .insert([{ profile_id: profileId, messages: toSave }]);
  }
}

// ── Snapshots Mensais (monthly_snapshots) ─

export async function loadMonthlySnapshots(profileId: string): Promise<MonthlySnapshot[]> {
  const { data, error } = await supabase
    .from('monthly_snapshots')
    .select('month, snapshot')
    .eq('profile_id', profileId)
    .order('month', { ascending: true });

  if (error || !data) return [];
  return data.map((row) => row.snapshot as MonthlySnapshot);
}

export async function saveMonthlySnapshot(profileId: string, snapshot: MonthlySnapshot): Promise<void> {
  const { data } = await supabase
    .from('monthly_snapshots')
    .select('id')
    .eq('profile_id', profileId)
    .eq('month', snapshot.month)
    .maybeSingle();

  if (data) {
    await supabase
      .from('monthly_snapshots')
      .update({ snapshot })
      .eq('id', data.id);
  } else {
    await supabase
      .from('monthly_snapshots')
      .insert([{ profile_id: profileId, month: snapshot.month, snapshot }]);
  }
}

// ── Visão Familiar (family_view_config) ───

export async function loadFamilyViewConfig(): Promise<FamilyViewConfig> {
  const userId = await getUserId();
  if (!userId) return { participatingProfileIds: [], isActive: false };

  const { data, error } = await supabase
    .from('family_view_config')
    .select('is_active, participating_profile_ids')
    .eq('account_id', userId)
    .maybeSingle();

  if (error || !data) return { participatingProfileIds: [], isActive: false };
  return {
    isActive: data.is_active,
    participatingProfileIds: data.participating_profile_ids,
  };
}

export async function saveFamilyViewConfig(config: FamilyViewConfig): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const { data } = await supabase
    .from('family_view_config')
    .select('id')
    .eq('account_id', userId)
    .maybeSingle();

  if (data) {
    await supabase
      .from('family_view_config')
      .update({
        is_active: config.isActive,
        participating_profile_ids: config.participatingProfileIds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id);
  } else {
    await supabase
      .from('family_view_config')
      .insert([{
        account_id: userId,
        is_active: config.isActive,
        participating_profile_ids: config.participatingProfileIds,
      }]);
  }
}

// ── Limpeza ───────────────────────────────

export async function clearProfileData(profileId: string): Promise<void> {
  // Como as tabelas têm ON DELETE CASCADE em relation ao profile, deletar as rows nas
  // tabelas filhas zera os dados, sem deletar o perfil em si.
  await supabase.from('financial_data').delete().eq('profile_id', profileId);
  await supabase.from('chat_history').delete().eq('profile_id', profileId);
  await supabase.from('monthly_snapshots').delete().eq('profile_id', profileId);
}

// O Logout lida com o "clearAllData", pois limpará a sessão.
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  localStorage.removeItem(ACTIVE_PROFILE_KEY);
  localStorage.removeItem(API_KEY_STORAGE);
}

// ── Migração de Dados Locais para Nuvem ──────

export async function migrateLocalDataToSupabase(): Promise<boolean> {
  const localProfilesStr = localStorage.getItem('af_profiles');
  if (!localProfilesStr) return false; // Não há dados locais para migrar

  try {
    const localProfiles: Profile[] = JSON.parse(localProfilesStr);
    if (!Array.isArray(localProfiles) || localProfiles.length === 0) return false;

    console.log('Iniciando migração de dados locais para o Supabase...');

    for (const localProfile of localProfiles) {
      const oldId = localProfile.id;

      // 1. Salvar perfil no Supabase (cria um novo UUID lá)
      const newProfile = await saveProfile({
        name: localProfile.name,
        avatar: localProfile.avatar,
        color: localProfile.color,
        allowFamilyView: localProfile.allowFamilyView,
      });

      if (!newProfile) {
        console.error(`Falha ao migrar o perfil: ${localProfile.name}`);
        continue;
      }

      const newId = newProfile.id;

      // 2. Migrar Dados Financeiros
      const finDataStr = localStorage.getItem(`af_profile_${oldId}_financial_data`);
      if (finDataStr) {
        const finData = JSON.parse(finDataStr);
        await saveFinancialData(newId, finData);
      }

      // 3. Migrar Histórico de Chat
      const chatStr = localStorage.getItem(`af_profile_${oldId}_chat_history`);
      if (chatStr) {
        const chat = JSON.parse(chatStr).map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        await saveChatHistory(newId, chat);
      }

      // 4. Migrar Snapshots
      const snapsStr = localStorage.getItem(`af_profile_${oldId}_monthly_snapshots`);
      if (snapsStr) {
        const snaps = JSON.parse(snapsStr);
        for (const snap of snaps) {
          await saveMonthlySnapshot(newId, snap);
        }
      }
    }

    // Marca como migrado
    localStorage.removeItem('af_profiles');
    console.log('Migração concluída com sucesso!');
    return true;
  } catch (err) {
    console.error('Erro durante a migração local -> nuvem', err);
    return false;
  }
}

// ── Recuperação de Dados Órfãos ──────
export async function recoverOrphanedData(): Promise<void> {
  console.log('Verificando dados órfãos...');
  const keys = Object.keys(localStorage);
  const orphanIds = new Set<string>();

  keys.forEach(k => {
    if (k.startsWith('af_profile_') && k.endsWith('_financial_data')) {
      const id = k.replace('af_profile_', '').replace('_financial_data', '');
      orphanIds.add(id);
    }
  });

  for (const oldId of orphanIds) {
    // Verificar se já migramos
    const { data: existing } = await supabase.from('profiles').select('id').eq('name', 'Perfil Recuperado ' + oldId);
    if (existing && existing.length > 0) continue;

    console.log('Recuperando dados para o ID:', oldId);
    const newProfile = await saveProfile({
      name: 'Perfil Recuperado ' + oldId,
      avatar: '🔄',
      color: '#10b981',
      allowFamilyView: false
    });

    if (newProfile) {
      const finDataStr = localStorage.getItem(`af_profile_${oldId}_financial_data`);
      if (finDataStr) await saveFinancialData(newProfile.id, JSON.parse(finDataStr));

      const chatStr = localStorage.getItem(`af_profile_${oldId}_chat_history`);
      if (chatStr) await saveChatHistory(newProfile.id, JSON.parse(chatStr).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })));

      const snapsStr = localStorage.getItem(`af_profile_${oldId}_monthly_snapshots`);
      if (snapsStr) {
        const snaps = JSON.parse(snapsStr);
        for (const snap of snaps) await saveMonthlySnapshot(newProfile.id, snap);
      }

      // Remover os dados antigos para não recuperar duas vezes
      localStorage.removeItem(`af_profile_${oldId}_financial_data`);
      localStorage.removeItem(`af_profile_${oldId}_chat_history`);
      localStorage.removeItem(`af_profile_${oldId}_monthly_snapshots`);
    }
  }
}

// ── Funções de Privacidade LGPD ──────────────────

export async function exportAllUserData(): Promise<any> {
  const userId = await getUserId();
  if (!userId) return null;

  const profilesList = await loadProfiles();
  const exportedProfiles = [];

  for (const profile of profilesList) {
    const finData = await loadFinancialData(profile.id);
    const chatHist = await loadChatHistory(profile.id);
    const snaps = await loadMonthlySnapshots(profile.id);

    exportedProfiles.push({
      profile,
      financialData: finData,
      chatHistory: chatHist,
      snapshots: snaps,
    });
  }

  const familyViewConfig = await loadFamilyViewConfig();

  return {
    appName: 'Analista Financeiro IA',
    exportDate: new Date().toISOString(),
    userId,
    profiles: exportedProfiles,
    familyViewConfig,
  };
}

export async function deleteAllUserData(): Promise<boolean> {
  const userId = await getUserId();
  if (!userId) return false;

  try {
    const profilesList = await loadProfiles();
    const profileIds = profilesList.map(p => p.id);

    if (profileIds.length > 0) {
      // Deletar dados filhos
      await supabase.from('financial_data').delete().in('profile_id', profileIds);
      await supabase.from('chat_history').delete().in('profile_id', profileIds);
      await supabase.from('monthly_snapshots').delete().in('profile_id', profileIds);

      // Deletar perfis
      await supabase.from('profiles').delete().in('id', profileIds);
    }

    // Deletar configurações da visão familiar
    await supabase.from('family_view_config').delete().eq('account_id', userId);

    return true;
  } catch (err) {
    console.error('Erro ao deletar dados do usuário:', err);
    return false;
  }
}


