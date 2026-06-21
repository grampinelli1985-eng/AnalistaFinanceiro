import { useState } from 'react';
import { supabase } from '../lib/supabase';

type PlanId = 'basic' | 'family';
type PaymentMethod = 'pix' | 'boleto' | 'cartao';
type CheckoutStatus = 'idle' | 'creating' | 'waiting_payment' | 'error';

export interface PlanInfo {
  id: PlanId;
  name: string;
  priceCents: number;
  maxInstallments: number;
}

interface ChargeResponse {
  subscriptionId: string;
  pixQrCodeImage?: string;
  pixCopyPaste?: string;
  boletoUrl?: string;
  invoiceUrl?: string;
}

interface PlanCheckoutModalProps {
  plan: PlanInfo;
  onClose: () => void;
  onSuccess: () => void;
}

const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'pix', label: 'PIX' },
  { id: 'boleto', label: 'Boleto' },
  { id: 'cartao', label: 'Cartão' },
];

/**
 * Modal de checkout para planos pagos (Basic/Family).
 *
 * Depende de duas rotas que ainda precisam existir em /api (Vercel functions):
 * - POST /api/checkout/create   -> cria a cobrança no Asaas, retorna dados pra pagar
 * - GET  /api/checkout/status   -> consulta se a assinatura já está 'active'
 */
export default function PlanCheckoutModal({ plan, onClose, onSuccess }: PlanCheckoutModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [installments, setInstallments] = useState<number>(1);
  const [cpfCnpj, setCpfCnpj] = useState<string>('');
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [charge, setCharge] = useState<ChargeResponse | null>(null);

  const priceReais = (plan.priceCents / 100).toFixed(2).replace('.', ',');

  async function handleConfirm() {
    setStatus('creating');
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Sessão expirada. Faça login novamente.');

      const res = await fetch('/api/checkout/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ planId: plan.id, method, installments, cpfCnpj }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || 'Não foi possível iniciar o pagamento. Tente novamente.');
      }
      const data: ChargeResponse = await res.json();
      setCharge(data);
      setStatus('waiting_payment');
      pollPaymentStatus(data.subscriptionId, accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
      setStatus('error');
    }
  }

  function pollPaymentStatus(subscriptionId: string, accessToken: string) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/checkout/status?subscriptionId=${subscriptionId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data: { status: string } = await res.json();
        if (data.status === 'active') {
          clearInterval(interval);
          onSuccess();
        }
      } catch {
        // silencioso — próxima tentativa do polling cobre isso
      }
    }, 4000);
    setTimeout(() => clearInterval(interval), 10 * 60 * 1000); // desiste após 10min
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
          aria-label="Fechar"
        >
          ✕
        </button>

        <h2 className="text-white text-xl font-semibold mb-1">Plano {plan.name}</h2>
        <p className="text-indigo-400 text-2xl font-bold mb-4">
          R$ {priceReais}
          <span className="text-slate-400 text-sm font-normal"> /ano</span>
        </p>

        {status !== 'waiting_payment' && (
          <>
            <p className="text-slate-300 text-sm mb-2">CPF ou CNPJ</p>
            <input
              type="text"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value.replace(/\D/g, ''))}
              placeholder="Somente números"
              maxLength={14}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white mb-4"
            />

            <p className="text-slate-300 text-sm mb-2">Forma de pagamento</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    method === m.id
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-slate-700 text-slate-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {method === 'cartao' && (
              <div className="mb-4">
                <label className="text-slate-300 text-sm block mb-1">Parcelas</label>
                <select
                  value={installments}
                  onChange={(e) => setInstallments(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white"
                >
                  {Array.from({ length: plan.maxInstallments }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x de R$ {(plan.priceCents / 100 / n).toFixed(2).replace('.', ',')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

            <button
              onClick={handleConfirm}
              disabled={status === 'creating' || cpfCnpj.length < 11}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg py-3 font-medium transition-colors"
            >
              {status === 'creating' ? 'Gerando cobrança...' : 'Confirmar pagamento'}
            </button>
          </>
        )}

        {status === 'waiting_payment' && charge && (
          <div className="text-center">
            {method === 'pix' && (
              <>
                <p className="text-slate-300 text-sm mb-3">Escaneie o QR Code para pagar via PIX</p>
                {charge.pixQrCodeImage && (
                  <img
                    src={charge.pixQrCodeImage}
                    alt="QR Code PIX"
                    className="mx-auto rounded-lg mb-3 w-48 h-48"
                  />
                )}
                {charge.pixCopyPaste && (
                  <p className="text-slate-400 text-xs break-all px-2">{charge.pixCopyPaste}</p>
                )}
              </>
            )}

            {method === 'boleto' && charge.boletoUrl && (
              <a
                href={charge.boletoUrl}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 underline text-sm"
              >
                Abrir boleto para pagamento
              </a>
            )}

            {method === 'cartao' && charge.invoiceUrl && (
              <a
                href={charge.invoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 underline text-sm"
              >
                Inserir dados do cartão para pagamento
              </a>
            )}

            <p className="text-slate-500 text-xs mt-4">
              Assim que o pagamento for confirmado, você é redirecionado automaticamente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
