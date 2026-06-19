// ==========================================
// MODAL DE CONFIGURAÇÕES GERAIS
// ==========================================

import React, { useState, useCallback } from 'react';
import type { Profile } from '../types/financial';

interface SettingsModalProps {
  profiles: Profile[];
  onUpdateProfile: (profile: Profile) => Promise<void>;
  onDeleteProfile: (profile: Profile) => Promise<void>;
  onClose: () => void;
  onExportData: () => Promise<void>;
  onDeleteAccountAndData: () => Promise<void>;
}

type SettingsTab = 'sharing' | 'privacy';

const SettingsModal: React.FC<SettingsModalProps> = ({
  profiles,
  onUpdateProfile,
  onDeleteProfile,
  onClose,
  onExportData,
  onDeleteAccountAndData,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('sharing');

  // Estados locais LGPD
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmedIrreversible, setConfirmedIrreversible] = useState(false);

  // Exclusão de perfil individual (Id -> Loading)
  const [deletingProfileIds, setDeletingProfileIds] = useState<Record<string, boolean>>({});


  // Toggles Saving State (Id -> Loading)
  const [updatingProfileIds, setUpdatingProfileIds] = useState<Record<string, boolean>>({});

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

  const handleDeleteProfile = useCallback(async (profile: Profile) => {
    if (profiles.length <= 1) return; // proteção extra na UI, além da que já existe no App.tsx

    if (!window.confirm(`Tem certeza que deseja excluir o perfil "${profile.name}"? Todos os dados financeiros, chats e histórico desse perfil serão perdidos permanentemente.`)) {
      return;
    }

    setDeletingProfileIds((prev) => ({ ...prev, [profile.id]: true }));
    try {
      await onDeleteProfile(profile);
    } catch (err) {
      console.error('Erro ao excluir perfil:', err);
    } finally {
      setDeletingProfileIds((prev) => ({ ...prev, [profile.id]: false }));
    }
  }, [onDeleteProfile, profiles.length]);

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

          {/* ── ABA 1: COMPARTILHAMENTO / PERFIS ── */}
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
                    const isDeletingThis = !!deletingProfileIds[p.id];
                    const isOnlyProfile = profiles.length <= 1;
                    return (
                      <div key={p.id} className="settings-profile-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="settings-profile-info" style={{ flex: 1 }}>
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

                        <button
                          type="button"
                          onClick={() => !isDeletingThis && !isOnlyProfile && handleDeleteProfile(p)}
                          disabled={isDeletingThis || isOnlyProfile}
                          aria-label={`Excluir perfil ${p.name}`}
                          title={isOnlyProfile ? 'Não é possível excluir o único perfil da conta' : `Excluir perfil ${p.name}`}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: isOnlyProfile ? 'not-allowed' : 'pointer',
                            opacity: isOnlyProfile ? 0.3 : 0.7,
                            color: 'var(--color-critical)',
                            padding: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: '0.95rem',
                          }}
                        >
                          {isDeletingThis ? (
                            <span className="spinner" style={{ width: 12, height: 12 }} />
                          ) : (
                            '🗑️'
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── ABA 2: PRIVACIDADE & DADOS (LGPD) ── */}
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

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    marginBottom: '12px',
                    padding: '10px',
                    background: 'rgba(239, 68, 68, 0.06)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    lineHeight: '1.4',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={confirmedIrreversible}
                    onChange={(e) => setConfirmedIrreversible(e.target.checked)}
                    style={{ marginTop: '2px', cursor: 'pointer', accentColor: 'var(--color-critical)' }}
                  />
                  <span>
                    Eu entendo que essa ação é <strong>irreversível</strong> e os dados não poderão ser recuperados.
                  </span>
                </label>

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
                    cursor: confirmedIrreversible ? 'pointer' : 'not-allowed',
                    opacity: confirmedIrreversible ? 1 : 0.5,
                    borderRadius: 'var(--radius-lg)'
                  }}
                  onClick={async () => {
                    if (!confirmedIrreversible) return;
                    if (window.confirm('AVISO CRÍTICO: Tem certeza que deseja excluir permanentemente todos os seus dados e perfis? Essa ação NÃO pode ser desfeita.')) {
                      setIsDeleting(true);
                      try {
                        await onDeleteAccountAndData();
                      } finally {
                        setIsDeleting(false);
                        setConfirmedIrreversible(false);
                      }
                    }
                  }}
                  disabled={isDeleting || !confirmedIrreversible}
                  aria-disabled={!confirmedIrreversible}
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
