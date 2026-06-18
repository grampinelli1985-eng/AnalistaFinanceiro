// ==========================================
// TELA DE SELEÇÃO DE PERFIS (estilo Netflix)
// ==========================================

import React, { useState } from 'react';
import type { Profile } from '../types/financial';

interface ProfileSelectScreenProps {
  profiles: Profile[];
  onSelectProfile: (profile: Profile) => void;
  onAddProfile: () => void;
  onOpenFamilyView: () => void;
  canShowFamilyView: boolean; // ≥2 perfis com allowFamilyView
}

const ProfileSelectScreen: React.FC<ProfileSelectScreenProps> = ({
  profiles,
  onSelectProfile,
  onAddProfile,
  onOpenFamilyView,
  canShowFamilyView,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="profile-select-screen">
      {/* Fundo animado */}
      <div className="profile-bg-orb profile-bg-orb-1" />
      <div className="profile-bg-orb profile-bg-orb-2" />

      {/* Logo / Título */}
      <div className="profile-select-header">
        <div className="profile-select-logo">🤖</div>
        <h1 className="profile-select-title">Analista Financeiro IA</h1>
        <p className="profile-select-subtitle">Quem está acessando agora?</p>
      </div>

      {/* Grid de Perfis */}
      <div className="profile-grid" role="list">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            id={`profile-card-${profile.id}`}
            className={`profile-card ${hoveredId === profile.id ? 'profile-card-hovered' : ''}`}
            style={{
              '--profile-color': profile.color,
            } as React.CSSProperties}
            onClick={() => onSelectProfile(profile)}
            onMouseEnter={() => setHoveredId(profile.id)}
            onMouseLeave={() => setHoveredId(null)}
            role="listitem"
            aria-label={`Acessar perfil de ${profile.name}`}
          >
            <div className="profile-card-avatar-wrapper">
              <div
                className="profile-card-avatar"
                style={{ background: `${profile.color}22`, border: `2px solid ${profile.color}` }}
              >
                <span className="profile-card-emoji">{profile.avatar}</span>
              </div>
              {/* Glow ring no hover */}
              <div
                className="profile-card-glow"
                style={{ boxShadow: `0 0 30px 8px ${profile.color}55` }}
              />
            </div>
            <span className="profile-card-name">{profile.name}</span>
          </button>
        ))}

        {/* Botão Adicionar Perfil */}
        {profiles.length < 5 && (
          <button
            id="add-profile-btn"
            className="profile-card profile-card-add"
            onClick={onAddProfile}
            aria-label="Adicionar novo perfil"
          >
            <div className="profile-card-avatar-wrapper">
              <div className="profile-card-avatar profile-card-avatar-add">
                <span className="profile-card-emoji">➕</span>
              </div>
            </div>
            <span className="profile-card-name">Adicionar perfil</span>
          </button>
        )}
      </div>

      {/* Visão Familiar */}
      {canShowFamilyView && (
        <button
          id="family-view-btn"
          className="profile-family-btn"
          onClick={onOpenFamilyView}
        >
          <span>👨‍👩‍👧</span>
          <span>Visão Familiar</span>
        </button>
      )}

      {/* Rodapé */}
      <p className="profile-select-footer">
        Cada perfil possui histórico e dados financeiros 100% isolados.
      </p>
    </div>
  );
};

export default ProfileSelectScreen;
