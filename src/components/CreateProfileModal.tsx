// ==========================================
// MODAL DE CRIAÇÃO / EDIÇÃO DE PERFIL
// ==========================================

import React, { useState } from 'react';
import type { Profile } from '../types/financial';
import { PROFILE_AVATARS, PROFILE_COLORS } from '../types/financial';

interface CreateProfileModalProps {
  existingProfile?: Profile | null; // se passado, modo edição
  onConfirm: (profile: Profile) => void;
  onCancel: () => void;
}

const CreateProfileModal: React.FC<CreateProfileModalProps> = ({
  existingProfile,
  onConfirm,
  onCancel,
}) => {
  const isEditing = !!existingProfile;

  const [name, setName] = useState(existingProfile?.name || '');
  const [avatar, setAvatar] = useState(existingProfile?.avatar || '👤');
  const [color, setColor] = useState(existingProfile?.color || PROFILE_COLORS[0]);
  const [allowFamilyView, setAllowFamilyView] = useState(existingProfile?.allowFamilyView || false);
  const [nameError, setNameError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Por favor, insira um nome para o perfil.');
      return;
    }
    if (trimmed.length > 20) {
      setNameError('O nome deve ter no máximo 20 caracteres.');
      return;
    }

    const profile: Profile = {
      id: existingProfile?.id || '',
      name: trimmed,
      avatar,
      color,
      createdAt: existingProfile?.createdAt || new Date().toISOString(),
      allowFamilyView,
    };
    onConfirm(profile);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 520 }} role="dialog" aria-labelledby="create-profile-title">
        <div className="modal-icon" style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}>
          {avatar}
        </div>

        <h2 id="create-profile-title" className="modal-title">
          {isEditing ? 'Editar Perfil' : 'Novo Perfil'}
        </h2>
        <p className="modal-description">
          {isEditing
            ? 'Atualize as informações do perfil.'
            : 'Crie um novo perfil com histórico e dados financeiros isolados.'}
        </p>

        <form onSubmit={handleSubmit}>
          {/* Nome */}
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="profile-name-input" className="modal-label">
              Nome do perfil
            </label>
            <input
              id="profile-name-input"
              type="text"
              className="modal-input"
              placeholder="Ex: João, Maria, Casal, Empresa..."
              value={name}
              maxLength={20}
              onChange={(e) => {
                setName(e.target.value);
                setNameError('');
              }}
              autoFocus
            />
            {nameError && <p className="modal-error">⚠️ {nameError}</p>}
            <p className="modal-hint">{name.trim().length}/20 caracteres</p>
          </div>

          {/* Avatar */}
          <div style={{ marginBottom: 20 }}>
            <label className="modal-label">Avatar</label>
            <div className="profile-picker-grid">
              {PROFILE_AVATARS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`profile-picker-item ${avatar === emoji ? 'selected' : ''}`}
                  style={avatar === emoji ? { background: `${color}22`, borderColor: color } : {}}
                  onClick={() => setAvatar(emoji)}
                  aria-label={`Selecionar avatar ${emoji}`}
                  aria-pressed={avatar === emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Cor */}
          <div style={{ marginBottom: 20 }}>
            <label className="modal-label">Cor de identificação</label>
            <div className="profile-color-grid">
              {PROFILE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`profile-color-swatch ${color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`Selecionar cor ${c}`}
                  aria-pressed={color === c}
                >
                  {color === c && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Autorizar visão familiar */}
          <div className="profile-toggle-row">
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                👨‍👩‍👧 Autorizar Visão Familiar
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                Permite que este perfil apareça na consolidação familiar
              </div>
            </div>
            <button
              type="button"
              id="toggle-family-view-btn"
              className={`profile-toggle ${allowFamilyView ? 'active' : ''}`}
              onClick={() => setAllowFamilyView(!allowFamilyView)}
              aria-checked={allowFamilyView}
              role="switch"
              style={allowFamilyView ? { background: color } : {}}
            >
              <div className="profile-toggle-thumb" />
            </button>
          </div>

          {/* Ações */}
          <div className="modal-actions" style={{ marginTop: 24 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onCancel}
            >
              Cancelar
            </button>
            <button
              id="confirm-profile-btn"
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim()}
            >
              {isEditing ? '✓ Salvar alterações' : '✓ Criar perfil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProfileModal;
