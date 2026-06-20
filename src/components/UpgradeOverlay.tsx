import React from 'react';

interface UpgradeOverlayProps {
  reason: 'limit_reached' | 'expired' | 'blocked' | 'past_due_expired' | null;
  limit?: number;
  onUpgradeClick: () => void;
  planName?: string;
}

const UpgradeOverlay: React.FC<UpgradeOverlayProps> = ({
  reason,
  limit = 20,
  onUpgradeClick,
  planName = 'BETA',
}) => {
  if (!reason) return null;

  const getOverlayContent = () => {
    switch (reason) {
      case 'limit_reached':
        return {
          emoji: '📊',
          title: 'Limite Diário Atingido',
          description: `Você enviou todas as suas mensagens de hoje para o plano **${planName}** (limite: ${limit} mensagens/dia pós-relatório).`,
          subtext: 'Para continuar enviando mensagens hoje, faça o upgrade para um plano superior ou aguarde o reset às 00:00 (Horário de Brasília).',
          buttonText: '🚀 Fazer Upgrade do Plano',
          showUpgradeButton: planName !== 'Plano Family', // Family já é o máximo
        };
      case 'expired':
        return {
          emoji: '⌛',
          title: 'Período de Testes Encerrado',
          description: 'Seu trial gratuito de 90 dias do plano **BETA** chegou ao fim.',
          subtext: 'Para continuar conversando com o Analista Financeiro IA, assine um de nossos planos anuais. Seu relatório gerado continuará disponível em modo somente leitura.',
          buttonText: '💳 Assinar Plano Premium',
          showUpgradeButton: true,
        };
      case 'past_due_expired':
        return {
          emoji: '⚠️',
          title: 'Assinatura Suspensa',
          description: 'Não conseguimos processar o pagamento da sua assinatura anual e o período de tolerância de 3 dias expirou.',
          subtext: 'Regularize seu pagamento ou faça uma nova assinatura para reativar o chat imediatamente.',
          buttonText: '💳 Regularizar Pagamento',
          showUpgradeButton: true,
        };
      case 'blocked':
      default:
        return {
          emoji: '🔒',
          title: 'Chat Bloqueado',
          description: 'O acesso ao chat está temporariamente suspenso para esta conta.',
          subtext: 'Por favor, assine um plano anual para liberar o chat e continuar sua organização financeira.',
          buttonText: '💳 Ativar Assinatura',
          showUpgradeButton: true,
        };
    }
  };

  const content = getOverlayContent();

  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-xl)',
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--color-border)',
        borderRadius: '16px',
        textAlign: 'center',
        margin: 'var(--space-md) auto',
        maxWidth: '560px',
        width: '90%',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
      }}
    >
      <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-sm)' }}>{content.emoji}</div>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#fff', marginBottom: 'var(--space-xs)' }}>
        {content.title}
      </h3>
      <p 
        style={{ 
          fontSize: '0.925rem', 
          color: 'var(--color-text-primary)', 
          lineHeight: 1.5, 
          marginBottom: 'var(--space-sm)',
          opacity: 0.9
        }}
        dangerouslySetInnerHTML={{ __html: content.description }}
      />
      <p 
        style={{ 
          fontSize: '0.8rem', 
          color: 'var(--color-text-secondary)', 
          lineHeight: 1.4, 
          marginBottom: 'var(--space-lg)',
          maxWidth: '420px'
        }}
      >
        {content.subtext}
      </p>

      {content.showUpgradeButton && (
        <button 
          onClick={onUpgradeClick}
          className="btn btn-primary"
          style={{
            background: 'linear-gradient(135deg, var(--color-accent) 0%, #4f46e5 100%)',
            border: 'none',
            color: '#fff',
            padding: '12px 24px',
            fontSize: '0.95rem',
            fontWeight: 600,
            borderRadius: '10px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px 0 rgba(99, 102, 241, 0.4)',
            transition: 'transform 0.2s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          {content.buttonText}
        </button>
      )}
    </div>
  );
};

export default UpgradeOverlay;
