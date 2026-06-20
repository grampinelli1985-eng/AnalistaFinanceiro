import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlanId?: 'basic' | 'family';
  onPaymentSuccess: () => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  initialPlanId = 'basic',
  onPaymentSuccess,
}) => {
  const [planId, setPlanId] = useState<'basic' | 'family'>(initialPlanId);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'boleto' | 'cartao'>('pix');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Checkout API responses
  const [pixData, setPixData] = useState<{ qrCode: string; qrCodeImage: string; copiaECola: string; subscriptionId: string } | null>(null);
  const [boletoData, setBoletoData] = useState<{ barcode: string; dueDate: string; bankSlipUrl?: string; subscriptionId: string } | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  // Credit Card Form
  const [holderName, setHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [ccv, setCcv] = useState('');
  const [cpf, setCpf] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [installments, setInstallments] = useState(1);

  // Reset state on open/close
  useEffect(() => {
    if (isOpen) {
      setPlanId(initialPlanId);
      setPaymentMethod('pix');
      setPixData(null);
      setBoletoData(null);
      setCheckoutSuccess(false);
      setError(null);
    }
  }, [isOpen, initialPlanId]);

  if (!isOpen) return null;

  const handleInitializeCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Usuário não autenticado.');

      const payload: any = {
        planId,
        method: paymentMethod,
      };

      if (paymentMethod === 'cartao') {
        payload.installments = Number(installments);
        payload.cardInfo = {
          holderName,
          number: cardNumber.replace(/\s/g, ''),
          expiryMonth,
          expiryYear,
          ccv,
          cpf: cpf.replace(/\D/g, ''),
          postalCode: postalCode.replace(/\D/g, ''),
          addressNumber,
        };
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar checkout.');
      }

      if (paymentMethod === 'pix') {
        setPixData(data);
      } else if (paymentMethod === 'boleto') {
        setBoletoData(data);
      } else if (paymentMethod === 'cartao') {
        setCheckoutSuccess(true);
        setTimeout(() => {
          onPaymentSuccess();
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setIsLoading(false);
    }
  };

  // Função utilitária para desenvolvimento que simula o pagamento do PIX/Boleto via Webhook
  const handleSimulatePaymentWebhook = async (subscriptionId: string, method: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/webhook-asaas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'PAYMENT_RECEIVED',
          simulated: true,
          subscriptionId,
          method,
          amount_cents: planId === 'family' ? 7990 : 5990,
          installments: 1
        }),
      });

      if (res.ok) {
        setCheckoutSuccess(true);
        setTimeout(() => {
          onPaymentSuccess();
          onClose();
        }, 2000);
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Erro na simulação do webhook');
      }
    } catch (err: any) {
      setError('Erro ao simular webhook: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getPlanDetails = () => {
    if (planId === 'family') {
      return { price: 'R$ 79,90', name: 'Plano FAMILY', profiles: 'Até 3 perfis', msgs: '100 msgs/dia' };
    }
    return { price: 'R$ 59,90', name: 'Plano BASIC', profiles: '1 perfil', msgs: '40 msgs/dia' };
  };

  const plan = getPlanDetails();

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, width: '90%', borderRadius: '16px', overflow: 'hidden', padding: 0, border: '1px solid rgba(255, 255, 255, 0.08)', background: 'var(--color-bg-panel)' }}>
        
        {/* Header do Checkout */}
        <div style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, #4f46e5 100%)', padding: 'var(--space-lg) var(--space-xl)', color: '#fff', position: 'relative' }}>
          <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 600 }}>Checkout de Assinatura</h2>
          <p style={{ margin: '4px 0 0 0', opacity: 0.85, fontSize: '0.85rem' }}>Libere a Inteligência Artificial e organize suas finanças</p>
          <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>

        {checkoutSuccess ? (
          <div style={{ padding: 'var(--space-2xl) var(--space-xl)', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>🎉</div>
            <h3 style={{ color: 'var(--color-green)', marginBottom: 'var(--space-sm)' }}>Pagamento Confirmado!</h3>
            <p style={{ color: 'var(--color-text-secondary)' }}>Obrigado por assinar! Seu plano foi ativado e seu acesso está liberado.</p>
          </div>
        ) : (
          <div style={{ padding: 'var(--space-xl)', maxHeight: '75vh', overflowY: 'auto' }}>
            
            {/* Escolha do Plano */}
            {!pixData && !boletoData && (
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <label className="modal-label" style={{ marginBottom: '8px' }}>Selecione seu Plano:</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div 
                    onClick={() => setPlanId('basic')}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '12px', border: `2px solid ${planId === 'basic' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      cursor: 'pointer', background: planId === 'basic' ? 'rgba(99, 102, 241, 0.06)' : 'none', textAlign: 'center'
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: '1rem' }}>BASIC</strong>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-accent)' }}>R$ 59,90<span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--color-text-secondary)' }}>/ano</span></span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>1 Perfil · 40 msgs/dia</span>
                  </div>
                  <div 
                    onClick={() => setPlanId('family')}
                    style={{
                      flex: 1, padding: '12px', borderRadius: '12px', border: `2px solid ${planId === 'family' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      cursor: 'pointer', background: planId === 'family' ? 'rgba(99, 102, 241, 0.06)' : 'none', textAlign: 'center'
                    }}
                  >
                    <strong style={{ display: 'block', fontSize: '1rem' }}>FAMILY</strong>
                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-accent)' }}>R$ 79,90<span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--color-text-secondary)' }}>/ano</span></span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>Até 3 Perfis · 100 msgs/dia</span>
                  </div>
                </div>
              </div>
            )}

            {/* Sumário do Pedido */}
            {!pixData && !boletoData && (
              <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border)', marginBottom: 'var(--space-lg)', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Assinatura Anual: <strong>{plan.name}</strong></span>
                  <strong>{plan.price}</strong>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                  {plan.profiles} · Limite diário: {plan.msgs} (pós-relatório)
                </div>
              </div>
            )}

            {/* Se Pix Gerado */}
            {pixData && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <h3 style={{ marginBottom: '8px' }}>Pague via Pix</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>Aponte a câmera do seu banco para o QR code abaixo ou copie o código.</p>
                <div style={{ background: '#fff', padding: '12px', borderRadius: '12px', display: 'inline-block', marginBottom: 'var(--space-md)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  <img src={pixData.qrCodeImage} alt="Pix QR Code" style={{ width: '200px', height: '200px', display: 'block' }} />
                </div>
                <div style={{ marginBottom: 'var(--space-lg)' }}>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(pixData.copiaECola); alert('Código copiado!'); }}
                    className="btn btn-secondary" 
                    style={{ fontSize: '0.85rem', width: '100%', maxWidth: '280px', margin: '0 auto' }}
                  >
                    📋 Copiar Código Pix
                  </button>
                </div>
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-lg)' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Ambiente de testes: simule o recebimento da transação instantaneamente</p>
                  <button 
                    onClick={() => handleSimulatePaymentWebhook(pixData.subscriptionId, 'pix')}
                    className="btn btn-primary"
                    disabled={isLoading}
                    style={{ background: 'var(--color-green)', border: 'none', color: '#fff', width: '100%', maxWidth: '280px' }}
                  >
                    {isLoading ? 'Confirmando...' : '⚡ Simular Pagamento Pix'}
                  </button>
                </div>
              </div>
            )}

            {/* Se Boleto Gerado */}
            {boletoData && (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <h3 style={{ marginBottom: '8px' }}>Boleto Bancário Gerado</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>Use a linha digitável abaixo no aplicativo do seu banco para realizar o pagamento.</p>
                <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--color-border)', borderRadius: '10px', fontSize: '0.9rem', wordBreak: 'break-all', fontFamily: 'monospace', marginBottom: 'var(--space-md)' }}>
                  {boletoData.barcode}
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: 'var(--space-lg)' }}>
                  <button 
                    onClick={() => { navigator.clipboard.writeText(boletoData.barcode); alert('Linha digitável copiada!'); }}
                    className="btn btn-secondary" 
                    style={{ fontSize: '0.85rem' }}
                  >
                    📋 Copiar Linha Digitável
                  </button>
                  {boletoData.bankSlipUrl && (
                    <a href={boletoData.bankSlipUrl} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>
                      🔗 Abrir Boleto PDF
                    </a>
                  )}
                </div>
                <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-lg)' }}>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Ambiente de testes: simule a compensação do boleto imediatamente</p>
                  <button 
                    onClick={() => handleSimulatePaymentWebhook(boletoData.subscriptionId, 'boleto')}
                    className="btn btn-primary"
                    disabled={isLoading}
                    style={{ background: 'var(--color-green)', border: 'none', color: '#fff', width: '100%', maxWidth: '280px' }}
                  >
                    {isLoading ? 'Compensando...' : '⚡ Simular Compensação Boleto'}
                  </button>
                </div>
              </div>
            )}

            {/* Seleção do Método (caso não gerado ainda) */}
            {!pixData && !boletoData && (
              <form onSubmit={handleInitializeCheckout}>
                <div style={{ marginBottom: 'var(--space-lg)' }}>
                  <label className="modal-label" style={{ marginBottom: '8px' }}>Método de Pagamento:</label>
                  <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
                    <button 
                      type="button" 
                      onClick={() => setPaymentMethod('pix')}
                      style={{ flex: 1, padding: '10px', background: paymentMethod === 'pix' ? 'var(--color-accent)' : 'none', border: 'none', color: paymentMethod === 'pix' ? '#fff' : 'var(--color-text-primary)', cursor: 'pointer' }}
                    >
                      Pix (Rápido)
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setPaymentMethod('boleto')}
                      style={{ flex: 1, padding: '10px', background: paymentMethod === 'boleto' ? 'var(--color-accent)' : 'none', border: 'none', color: paymentMethod === 'boleto' ? '#fff' : 'var(--color-text-primary)', cursor: 'pointer', borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)' }}
                    >
                      Boleto
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setPaymentMethod('cartao')}
                      style={{ flex: 1, padding: '10px', background: paymentMethod === 'cartao' ? 'var(--color-accent)' : 'none', border: 'none', color: paymentMethod === 'cartao' ? '#fff' : 'var(--color-text-primary)', cursor: 'pointer' }}
                    >
                      Cartão de Crédito
                    </button>
                  </div>
                </div>

                {/* Formulário de Cartão de Crédito */}
                {paymentMethod === 'cartao' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px', border: '1px solid var(--color-border)', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.01)', marginBottom: 'var(--space-lg)' }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem' }}>Dados do Cartão de Crédito</h4>
                    <input 
                      type="text" 
                      placeholder="Nome impresso no cartão" 
                      required 
                      value={holderName} 
                      onChange={(e) => setHolderName(e.target.value)} 
                      className="auth-input" 
                      style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                    />
                    <input 
                      type="text" 
                      placeholder="Número do Cartão" 
                      required 
                      maxLength={19}
                      value={cardNumber} 
                      onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim())} 
                      className="auth-input" 
                      style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        placeholder="Mês (MM)" 
                        required 
                        maxLength={2}
                        value={expiryMonth} 
                        onChange={(e) => setExpiryMonth(e.target.value.replace(/\D/g, ''))} 
                        className="auth-input" 
                        style={{ flex: 1, padding: '8px 12px', fontSize: '0.875rem' }}
                      />
                      <input 
                        type="text" 
                        placeholder="Ano (AA)" 
                        required 
                        maxLength={2}
                        value={expiryYear} 
                        onChange={(e) => setExpiryYear(e.target.value.replace(/\D/g, ''))} 
                        className="auth-input" 
                        style={{ flex: 1, padding: '8px 12px', fontSize: '0.875rem' }}
                      />
                      <input 
                        type="text" 
                        placeholder="CVV" 
                        required 
                        maxLength={4}
                        value={ccv} 
                        onChange={(e) => setCcv(e.target.value.replace(/\D/g, ''))} 
                        className="auth-input" 
                        style={{ flex: 1, padding: '8px 12px', fontSize: '0.875rem' }}
                      />
                    </div>
                    
                    <h4 style={{ margin: '6px 0 2px 0', fontSize: '0.9rem' }}>Dados do Titular</h4>
                    <input 
                      type="text" 
                      placeholder="CPF do Titular" 
                      required 
                      maxLength={14}
                      value={cpf} 
                      onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'))} 
                      className="auth-input" 
                      style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        placeholder="CEP (ex: 01311-200)" 
                        required 
                        maxLength={9}
                        value={postalCode} 
                        onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2'))} 
                        className="auth-input" 
                        style={{ flex: 2, padding: '8px 12px', fontSize: '0.875rem' }}
                      />
                      <input 
                        type="text" 
                        placeholder="Número Endereço" 
                        required 
                        value={addressNumber} 
                        onChange={(e) => setAddressNumber(e.target.value)} 
                        className="auth-input" 
                        style={{ flex: 1, padding: '8px 12px', fontSize: '0.875rem' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                      <label className="modal-label" style={{ fontSize: '0.8rem' }}>Parcelamento:</label>
                      <select 
                        value={installments} 
                        onChange={(e) => setInstallments(Number(e.target.value))}
                        className="auth-input"
                        style={{ padding: '8px 12px', fontSize: '0.875rem', background: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
                      >
                        {planId === 'family' ? (
                          <>
                            <option value={1}>1x de R$ 79,90 (Sem juros)</option>
                            <option value={2}>2x de R$ 39,95 (Sem juros)</option>
                            <option value={3}>3x de R$ 26,63 (Sem juros)</option>
                            <option value={4}>4x de R$ 19,97 (Sem juros)</option>
                            <option value={5}>5x de R$ 15,98 (Sem juros)</option>
                            <option value={6}>6x de R$ 13,31 (Sem juros)</option>
                            <option value={7}>7x de R$ 11,41 (Sem juros)</option>
                            <option value={8}>8x de R$ 9,98 (Sem juros)</option>
                            <option value={9}>9x de R$ 8,87 (Sem juros)</option>
                            <option value={10}>10x de R$ 7,99 (Sem juros)</option>
                          </>
                        ) : (
                          <>
                            <option value={1}>1x de R$ 59,90 (Sem juros)</option>
                            <option value={2}>2x de R$ 29,95 (Sem juros)</option>
                            <option value={3}>3x de R$ 19,96 (Sem juros)</option>
                            <option value={4}>4x de R$ 14,97 (Sem juros)</option>
                            <option value={5}>5x de R$ 11,98 (Sem juros)</option>
                            <option value={6}>6x de R$ 9,98 (Sem juros)</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                )}

                {error && (
                  <p className="modal-error" role="alert" style={{ fontSize: '0.85rem', marginBottom: 'var(--space-md)' }}>
                    ⚠️ {error}
                  </p>
                )}

                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="btn btn-primary" 
                  style={{ width: '100%', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem', fontWeight: 600 }}
                >
                  {isLoading ? (
                    <span className="spinner" style={{ width: 20, height: 20 }} />
                  ) : paymentMethod === 'cartao' ? 'Confirmar e Pagar Agora' : 'Gerar Cobrança'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutModal;
