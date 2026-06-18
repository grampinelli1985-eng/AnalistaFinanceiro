// ==========================================
// MODAL DE CONFIGURAÇÕES GERAIS
// ==========================================

import React, { useState, useCallback } from 'react';
import { validateApiKey } from '../services/aiService';
import type { Profile } from '../types/financial';

interface SettingsModalProps {
  onConfirmApiKey: (apiKey: string) => void;
  existingKey?: string;
  profiles: Profile[];
  onUpdateProfile: (profile: Profile) => Promise<void>;
  onClose: () => void;
  onExportData: () => Promise<void>;
  onDeleteAccountAndData: () => Promise<void>;
}

type SettingsTab = 'api' | 'sharing' | 'privacy';

const SettingsModal: React.FC<SettingsModalProps> = ({
  onConfirmApiKey,
  existingKey,
  profiles,
  onUpdateProfile,
  onClose,
  onExportData,
  onDeleteAccountAndData,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('api');
  
  // API Key States
  const [apiKey, setApiKey] = useState(existingKey || '');
  const [isValidating, setIsValidating] = useState(false);
  const [apiError, setApiError] = useState('');

  // Estados locais LGPD
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);


  // Toggles Saving State (Id -> Loading)
  const [updatingProfileIds, setUpdatingProfileIds] = useState<Record<string, boolean>>({});

  const handleApiKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setApiError('Por favor, insira sua chave da API Gemini.');
      return;
    }

    setIsValidating(true);
    setApiError('');

    try {
      const isValid = await validateApiKey(trimmed);
      if (isValid) {
        onConfirmApiKey(trimmed);
      } else {
        setApiError('Chave inválida ou sem permissão. Verifique e tente novamente.');
      }
    } catch {
      setApiError('Erro ao validar a chave. Verifique sua conexão.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleToggleFamilyView = useCallback(async (profile: Profile) => {
    setUpdatingProfileIds((prev) => ({ ...prev, [profile.id]: true }));
    try {
      await onUpdateProfile({
        ...profile,
        allowFamilyView: !profile.allowFamilyView,
      });
    } catch (err) {
      console.error('Erro ao atualizar permissão do perfil:', err);
    } finally {
      setUpdatingProfileIds((prev) => ({ ...prev, [profile.id]: false }));
    }
  }, [onUpdateProfile]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 500 }} role="dialog" aria-labelledby="settings-title">
        {/* Cabeçalho */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 id="settings-title" className="modal-title" style={{ margin: 0 }}>
            Configurações
          </h2>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-icon"
            style={{ width: 28, height: 28, borderRadius: '50%' }}
            aria-label="Fechar configurações"
          >
            ✕
          </button>
        </div>

        {/* Abas */}
        <div className="settings-tabs" role="tablist">
          <button
            className={`settings-tab ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}
            role="tab"
            aria-selected={activeTab === 'api'}
          >
            🔑 API Gemini
          </button>
          <button
            className={`settings-tab ${activeTab === 'sharing' ? 'active' : ''}`}
            onClick={() => setActiveTab('sharing')}
            role="tab"
            aria-selected={activeTab === 'sharing'}
          >
            👨‍👩‍👧 Visão Familiar
          </button>
          <button
            className={`settings-tab ${activeTab === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('privacy')}
            role="tab"
            aria-selected={activeTab === 'privacy'}
          >
            🛡️ Privacidade & LGPD
          </button>
        </div>

        {/* Conteúdo */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 220 }}>
          
          {/* ── ABA 1: API KEY ── */}
          {activeTab === 'api' && (
            <form onSubmit={handleApiKeySubmit} style={{ marginTop: '8px' }}>
              <p className="modal-description" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                A inteligência da aplicação é alimentada pela API do Google Gemini.
                Sua chave fica segura apenas no seu navegador e não passa por servidores intermediários.
              </p>

              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="settings-api-key" className="modal-label">
                  Chave da API Gemini
                </label>
                <input
                  id="settings-api-key"
                  type="password"
                  className="modal-input"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setApiError('');
                  }}
                  autoComplete="off"
                  spellCheck={false}
                />
                
                {apiError && (
                  <p className="modal-error" role="alert" style={{ marginTop: '8px' }}>
                    ⚠️ {apiError}
                  </p>
                )}
              </div>

              <div
                style={{
                  marginTop: '12px',
                  padding: '12px',
                  background: 'rgba(99, 102, 241, 0.08)',
                  borderRadius: '8px',
                  fontSize: '0.8125rem',
                  color: 'var(--color-text-secondary)',
                  lineHeight: '1.5',
                  marginBottom: '16px'
                }}
              >
                <strong style={{ color: 'var(--color-text-accent)' }}>Como obter sua chave:</strong>
                <br />
                1. Acesse{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-accent-hover)', textDecoration: 'underline' }}
                >
                  aistudio.google.com/app/apikey
                </a>
                <br />
                2. Faça login ou crie uma conta
                <br />
                3. Vá em "API Keys" e crie uma nova chave
              </div>

              <div
                style={{
                  padding: '10px 12px',
                  background: 'rgba(99, 102, 241, 0.06)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  color: 'var(--color-text-secondary)',
                  lineHeight: '1.5',
                  marginBottom: '20px'
                }}
              >
                🔒 <strong>Segurança:</strong> Armazenada exclusivamente no seu localStorage.
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={isValidating || apiKey.trim() === (existingKey || '')}
              >
                {isValidating ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14 }} />
                    Validando chave...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </button>
            </form>
          )}

          {/* ── ABA 2: COMPARTILHAMENTO / PERFIS ── */}
          {activeTab === 'sharing' && (
            <div style={{ marginTop: '8px' }}>
              <p className="modal-description" style={{ fontSize: '0.85rem', marginBottom: '16px' }}>
                Selecione quais perfis autorizam compartilhar seus balanços e dados com a **Visão Familiar Consolidada** da conta.
              </p>

              {profiles.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem', marginTop: '24px' }}>
                  Nenhum perfil encontrado.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {profiles.map((p) => {
                    const isSaving = !!updatingProfileIds[p.id];
                    return (
                      <div key={p.id} className="settings-profile-row">
                        <div className="settings-profile-info">
                          <div
                            className="settings-profile-avatar"
                            style={{
                              background: `${p.color}22`,
                              border: `1.5px solid ${p.color}`,
                            }}
                          >
                            {p.avatar}
                          </div>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.name}</span>
                        </div>

                        <button
                          type="button"
                          className={`profile-toggle ${p.allowFamilyView ? 'active' : ''}`}
                          onClick={() => !isSaving && handleToggleFamilyView(p)}
                          disabled={isSaving}
                          aria-checked={p.allowFamilyView}
                          role="switch"
                          style={p.allowFamilyView && !isSaving ? { background: p.color } : {}}
                          title={p.allowFamilyView ? 'Desativar Visão Familiar' : 'Ativar Visão Familiar'}
                        >
                          {isSaving ? (
                            <span className="spinner" style={{ width: 12, height: 12, position: 'absolute', top: 6, left: p.allowFamilyView ? 24 : 6 }} />
                          ) : (
                            <div className="profile-toggle-thumb" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── ABA 3: PRIVACIDADE & DADOS (LGPD) ── */}
          {activeTab === 'privacy' && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h4 style={{ margin: '0 0 4px', color: 'var(--color-text-primary)', fontSize: '0.85rem' }}>Documentos Legais</h4>
                <p className="modal-description" style={{ fontSize: '0.75rem', marginBottom: '8px' }}>
                  Consulte os termos e políticas da nossa plataforma.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a
                    href="/termos-de-uso.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem', border: '1px solid var(--color-border)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}
                  >
                    📄 Ver Termos de Uso
                  </a>
                  <a
                    href="/politica-de-privacidade.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1, padding: '6px 10px', fontSize: '0.75rem', border: '1px solid var(--color-border)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}
                  >
                    🛡️ Ver Pol. de Privacidade
                  </a>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px' }}>
                <h4 style={{ margin: '0 0 4px', color: 'var(--color-text-primary)', fontSize: '0.85rem' }}>Portabilidade dos Dados</h4>
                <p className="modal-description" style={{ fontSize: '0.75rem', marginBottom: '8px' }}>
                  Baixe um arquivo JSON contendo todas as informações de perfis, finanças e chats.
                </p>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm w-full"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', fontSize: '0.78rem', border: '1px solid var(--color-border)' }}
                  onClick={async () => {
                    setIsExporting(true);
                    try {
                      await onExportData();
                    } finally {
                      setIsExporting(false);
                    }
                  }}
                  disabled={isExporting}
                >
                  {isExporting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '📥'} Exportar Meus Dados (JSON)
                </button>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '12px', marginBottom: '4px' }}>
                <h4 style={{ margin: '0 0 2px', color: 'var(--color-critical)', fontSize: '0.85rem' }}>Direito ao Esquecimento</h4>
                <p className="modal-description" style={{ fontSize: '0.75rem', marginBottom: '8px' }}>
                  Exclui permanentemente todos os perfis, chats e snapshots. Esta ação é <strong>irreversível</strong>.
                </p>
                <button
                  type="button"
                  className="btn btn-sm w-full"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.3) 100%)',
                    border: '1px solid var(--color-critical)',
                    color: 'var(--color-text-primary)',
                    padding: '8px',
                    fontSize: '0.78rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-lg)'
                  }}
                  onClick={async () => {
                    if (window.confirm('AVISO CRÍTICO: Tem certeza que deseja excluir permanentemente todos os seus dados e perfis? Essa ação NÃO pode ser desfeita.')) {
                      setIsDeleting(true);
                      try {
                        await onDeleteAccountAndData();
                      } finally {
                        setIsDeleting(false);
                      }
                    }
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '🗑️'} Excluir Minha Conta e Todos os Dados
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
