// ==========================================
// BADGE DO PERFIL ATIVO (exibido no header)
// ==========================================

import React from 'react';
import type { Profile } from '../types/financial';

interface ProfileBadgeProps {
  profile: Profile;
  onClick: () => void;
}

const ProfileBadge: React.FC<ProfileBadgeProps> = ({ profile, onClick }) => (
  <button
    id="active-profile-badge"
    className="profile-badge"
    onClick={onClick}
    title={`Perfil ativo: ${profile.name} — Clique para trocar`}
    aria-label={`Trocar perfil (atual: ${profile.name})`}
    style={{ '--profile-color': profile.color } as React.CSSProperties}
  >
    <div
      className="profile-badge-avatar"
      style={{
        background: `${profile.color}22`,
        border: `1.5px solid ${profile.color}`,
        boxShadow: `0 0 8px ${profile.color}44`,
      }}
    >
      {profile.avatar}
    </div>
    <div className="profile-badge-info">
      <span className="profile-badge-name">{profile.name}</span>
      <span className="profile-badge-action">Trocar perfil</span>
    </div>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  </button>
);

export default ProfileBadge;
