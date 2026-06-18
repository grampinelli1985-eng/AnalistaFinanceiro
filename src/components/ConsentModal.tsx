// ==========================================
// COMPONENTE: MODAL DE CONSENTIMENTO LGPD
// ==========================================

import React, { useState } from 'react';

interface ConsentModalProps {
  onAcceptConsent: () => Promise<void>;
  onLogout: () => Promise<void>;
}

const ConsentModal: React.FC<ConsentModalProps> = ({ onAcceptConsent, onLogout }) => {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms || !acceptedPrivacy) return;

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await onAcceptConsent();
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao salvar consentimento. Verifique sua conexão e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="modal-overlay" style={{ background: 'rgba(5, 10, 20, 0.95)', backdropFilter: 'blur(8px)', zIndex: 9999 }}>
        <div className="modal-box" style={{ maxWidth: 480, padding: '32px', textAlign: 'center' }} role="dialog" aria-labelledby="consent-title">
          
          {/* Logo */}
          <div className="profile-select-logo" style={{ margin: '0 auto 16px', width: 56, height: 56, fontSize: 28 }}>
            🛡️
          </div>

          <h2 id="consent-title" className="modal-title" style={{ fontSize: '1.4rem', marginBottom: '12px' }}>
            Privacidade & Segurança de Dados
          </h2>

          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
            Para continuarmos a diagnosticar suas finanças com inteligência artificial, precisamos que você leia e concorde com os nossos termos de tratamento de dados sob a lei brasileira <strong>LGPD</strong>.
          </p>

          <form onSubmit={handleSubmit} style={{ textAlign: 'left', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
            
            {/* Checkbox Termos */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '16px' }}>
              <input
                id="consent-terms"
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                style={{ marginTop: '4px', cursor: 'pointer' }}
                disabled={isSubmitting}
              />
              <label htmlFor="consent-terms" style={{ fontSize: '0.825rem', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                Li e aceito os{' '}
                <a
                  href="/termos-de-uso.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-accent)', textDecoration: 'underline', fontWeight: '500' }}
                >
                  Termos de Uso
                </a>
                .
              </label>
            </div>

            {/* Checkbox Privacidade */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <input
                id="consent-privacy"
                type="checkbox"
                checked={acceptedPrivacy}
                onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                style={{ marginTop: '4px', cursor: 'pointer' }}
                disabled={isSubmitting}
              />
              <label htmlFor="consent-privacy" style={{ fontSize: '0.825rem', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                Li e aceito a{' '}
                <a
                  href="/politica-de-privacidade.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--color-accent)', textDecoration: 'underline', fontWeight: '500' }}
                >
                  Política de Privacidade
                </a>
                .
              </label>
            </div>

          </form>

          {errorMsg && (
            <p className="modal-error" role="alert" style={{ fontSize: '0.8rem', marginBottom: '16px', textAlign: 'center' }}>
              ⚠️ {errorMsg}
            </p>
          )}

          {/* Botões */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              type="submit"
              onClick={handleSubmit}
              className="btn btn-primary w-full"
              style={{ padding: '12px 24px', fontSize: '0.9rem' }}
              disabled={!acceptedTerms || !acceptedPrivacy || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                  Salvando consentimento...
                </>
              ) : (
                'Aceitar e Continuar'
              )}
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="btn btn-ghost w-full"
              style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}
              disabled={isSubmitting}
            >
              Cancelar e Sair da Conta
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default ConsentModal;
