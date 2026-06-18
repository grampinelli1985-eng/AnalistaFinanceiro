import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);
      setSuccessMsg(null);

      if (isRegistering) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setSuccessMsg('Conta criada! Você já pode fazer login (ou verifique seu email se o Supabase exigir).');
        setIsRegistering(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error('Erro de Autenticação:', err);
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="profile-select-screen" style={{ justifyContent: 'center' }}>
      <div className="profile-bg-orb profile-bg-orb-1" />
      <div className="profile-bg-orb profile-bg-orb-2" />

      <div className="profile-select-header" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="profile-select-logo">🤖</div>
        <h1 className="profile-select-title">Analista Financeiro IA</h1>
        <p className="profile-select-subtitle">Seu consultor financeiro pessoal e implacável</p>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: 400, textAlign: 'center', padding: 'var(--space-xl) var(--space-lg)' }}>
        <h2 style={{ marginBottom: 'var(--space-md)' }}>Acesse sua conta</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xl)', fontSize: '0.9375rem' }}>
          Para fins de teste, você pode usar qualquer e-mail e senha.
        </p>

        <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <input
            type="email"
            placeholder="Seu E-mail (ex: teste@teste.com)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            required
          />
          <input
            type="password"
            placeholder="Senha (mínimo 6 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            required
            minLength={6}
          />
          
          {error && (
            <div style={{ color: 'var(--color-critical)', fontSize: '0.875rem', textAlign: 'left', marginTop: 'var(--space-xs)' }}>
              ⚠️ {error === 'Invalid login credentials' ? 'Senha incorreta ou usuário não encontrado.' : error === 'User already registered' ? 'Este e-mail já tem uma conta. Clique abaixo em "Já tenho uma conta" e faça login.' : error}
            </div>
          )}

          <button 
            type="submit"
            disabled={isLoading}
            className="btn btn-primary" 
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48, fontSize: '1rem', marginTop: 'var(--space-sm)' }}
          >
            {isLoading ? 'Aguarde...' : (isRegistering ? 'Criar Conta' : 'Fazer Login')}
          </button>
        </form>

        <div style={{ marginTop: 'var(--space-lg)', fontSize: '0.875rem' }}>
          <button 
            onClick={() => { setIsRegistering(!isRegistering); setError(null); setSuccessMsg(null); }}
            style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isRegistering ? 'Já tenho uma conta. Fazer login.' : 'Ainda não tenho conta. Criar conta temporária.'}
          </button>
        </div>

        {successMsg && (
          <div style={{ marginTop: 'var(--space-md)', color: 'var(--color-green)', fontSize: '0.875rem' }}>
            ✅ {successMsg}
          </div>
        )}
      </div>

      <p className="profile-select-footer" style={{ marginTop: 'var(--space-2xl)' }}>
        Protegido pelo Supabase Auth. Seus dados são isolados com segurança.
      </p>
    </div>
  );
};

export default LoginScreen;
