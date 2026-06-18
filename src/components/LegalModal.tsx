// ==========================================
// COMPONENTE: MODAL LEGAL (TERMOS E PRIVACIDADE)
// ==========================================

import React, { useState } from 'react';

interface LegalModalProps {
  initialTab?: 'terms' | 'privacy';
  onClose: () => void;
}

const LegalModal: React.FC<LegalModalProps> = ({ initialTab = 'terms', onClose }) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>(initialTab);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 650, height: '80vh', display: 'flex', flexDirection: 'column' }} role="dialog" aria-labelledby="legal-title">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
          <h2 id="legal-title" className="modal-title" style={{ margin: 0 }}>
            Documentos Legais
          </h2>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-icon"
            style={{ width: 28, height: 28, borderRadius: '50%' }}
            aria-label="Fechar modal legal"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="settings-tabs" role="tablist" style={{ marginBottom: '16px', flexShrink: 0 }}>
          <button
            className={`settings-tab ${activeTab === 'terms' ? 'active' : ''}`}
            onClick={() => setActiveTab('terms')}
            role="tab"
            aria-selected={activeTab === 'terms'}
          >
            📄 Termos de Uso
          </button>
          <button
            className={`settings-tab ${activeTab === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('privacy')}
            role="tab"
            aria-selected={activeTab === 'privacy'}
          >
            🛡️ Política de Privacidade
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
          
          {activeTab === 'terms' ? (
            <div className="legal-content">
              <h3 style={{ color: 'var(--color-text-primary)', marginTop: 0 }}>Termos de Uso</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Última atualização: 16 de Junho de 2026</p>
              
              <p>
                Bem-vindo ao <strong>Analista Financeiro IA</strong>. Ao acessar ou utilizar nossa plataforma, você concorda em cumprir e vincular-se a estes Termos de Uso. Por favor, leia-os com atenção antes de utilizar o serviço.
              </p>

              <h4 style={{ color: 'var(--color-text-primary)', marginTop: '20px' }}>1. Aceitação dos Termos</h4>
              <p>
                Ao criar uma conta ou utilizar os serviços do Analista Financeiro IA, você expressa seu consentimento livre, expresso e informado com estes Termos. Caso não concorde com qualquer disposição aqui estabelecida, você não deverá utilizar a plataforma.
              </p>

              <h4 style={{ color: 'var(--color-text-primary)', marginTop: '20px' }}>2. Descrição do Serviço</h4>
              <p>
                O Analista Financeiro IA é uma plataforma baseada na web projetada para auxiliar na organização de despesas, planejamento de quitação de dívidas e simulações financeiras. O serviço utiliza a tecnologia de Inteligência Artificial do Google Gemini para interpretar os dados que você insere voluntariamente na interface de chat e gerar orientações financeiras dinâmicas.
              </p>

              <h4 style={{ color: 'var(--color-text-primary)', marginTop: '20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                ⚠️ 3. Isenção de Aconselhamento Profissional
              </h4>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', borderLeft: '3px solid var(--color-critical)', padding: '12px', borderRadius: '4px', marginBottom: '16px' }}>
                <strong>IMPORTANTE:</strong> O Analista Financeiro IA oferece relatórios e análises exclusivamente informativas e educacionais geradas de forma automatizada por inteligência artificial.
                <br /><br />
                <strong>A PLATAFORMA NÃO CONSTITUI ACONSELHAMENTO FINANCEIRO PROFISSIONAL, PLANEJAMENTO TRIBUTÁRIO, JURÍDICO OU CONSULTORIA DE INVESTIMENTOS CERTIFICADA.</strong>
                <br /><br />
                Você é o único responsável por suas decisões financeiras. Recomendamos fortemente consultar um planejador financeiro ou consultor certificado credenciado (como CFP® ou analista CNPI) antes de realizar decisões de grande impacto financeiro, quitações extraordinárias ou investimentos.
              </div>

              <h4 style={{ color: 'var(--color-text-primary)', marginTop: '20px' }}>4. Cadastro e Segurança</h4>
              <p>
                Para usufruir da sincronização em nuvem, você deve criar uma conta de usuário utilizando a infraestrutura do Supabase Auth. Você é responsável por manter a confidencialidade de sua senha de acesso e por todas as atividades que ocorrem sob sua conta.
              </p>

              <h4 style={{ color: 'var(--color-text-primary)', marginTop: '20px' }}>5. Chave de API de Terceiros</h4>
              <p>
                A inteligência da aplicação é ativada através do fornecimento de sua própria Chave de API do Google Gemini. Esta chave é armazenada de forma local no seu próprio navegador (localStorage) e transmitida diretamente aos servidores do Google apenas para processar suas mensagens, garantindo que o Analista Financeiro IA não armazene sua chave de API em servidores intermediários proprietários.
              </p>

              <h4 style={{ color: 'var(--color-text-primary)', marginTop: '20px' }}>6. Versão Beta e Limites de Serviço</h4>
              <p>
                Atualmente, a plataforma opera em regime de testes (Acesso Beta Antecipado). Reservamo-nos o direito de modificar, suspender ou descontinuar recursos sem aviso prévio, assim como impor limites no número de cadastros de forma a assegurar a performance da aplicação.
              </p>

              <h4 style={{ color: 'var(--color-text-primary)', marginTop: '20px' }}>7. Modificações dos Termos</h4>
              <p>
                Estes Termos podem ser atualizados periodicamente para refletir mudanças regulatórias ou evoluções nas funcionalidades. Notificaremos os usuários sobre alterações materiais através do app. A continuidade do uso do serviço após tais alterações constitui sua aceitação tácita.
              </p>
            </div>
          ) : (
            <div className="legal-content">
              <h3 style={{ color: 'var(--color-text-primary)', marginTop: 0 }}>Política de Privacidade</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Última atualização: 16 de Junho de 2026</p>
              
              <p>
                Sua privacidade é nossa prioridade máxima. Esta Política de Privacidade descreve como o <strong>Analista Financeiro IA</strong> coleta, armazena, processa e protege seus dados em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/18).
              </p>

              <h4 style={{ color: 'var(--color-text-primary)', marginTop: '20px' }}>1. Dados que Coletamos</h4>
              <p>
                Coletamos apenas as informações estritamente necessárias para a prestação do serviço:
              </p>
              <ul>
                <li><strong>Dados de Autenticação:</strong> E-mail e senha de cadastro gerenciados de forma segura e criptografada pelo Supabase Auth.</li>
                <li><strong>Dados de Perfil:</strong> Nome fictício ou real, cor temática do perfil e avatar escolhidos para identificação interna.</li>
                <li><strong>Dados Financeiros Inseridos por Você:</strong> Valores de receita, despesas fixas, despesas variáveis, contas a pagar, taxas de juros de dívidas e investimentos informados voluntariamente nas conversas com a IA.</li>
                <li><strong>Histórico de Chat:</strong> O texto das conversas enviadas por você e as respostas geradas pela IA para fins de manutenção do contexto da conversa.</li>
                <li><strong>Metadados do Cadastro:</strong> Registros técnicos como data e hora de criação da conta e timestamps de consentimento dos termos de uso.</li>
              </ul>

              <h4 style={{ color: 'var(--color-text-primary)', marginTop: '20px' }}>2. Finalidade do Processamento</h4>
              <p>
                Os dados financeiros e o histórico de conversação são utilizados unicamente para:
              </p>
              <ol>
                <li>Alimentar o modelo de inteligência artificial Google Gemini de forma a produzir respostas coerentes, personalizadas e contextualizadas sobre sua situação financeira.</li>
                <li>Montar e exibir os painéis visuais (dashboard de orçamento, progresso de dívidas e análises críticas) dentro do aplicativo.</li>
                <li>Gerar os relatórios para download (PDF).</li>
              </ol>

              <h4 style={{ color: 'var(--color-text-primary)', marginTop: '20px' }}>3. Compartilhamento e Transferência de Dados</h4>
              <p>
                O Analista Financeiro IA preza pela minimização de dados. Suas informações financeiras e de conversas são enviadas de forma temporária e segura via API criptografada (HTTPS) ao <strong>Google Gemini API</strong> para processamento da inteligência artificial. Este envio respeita as políticas de uso do Google para desenvolvedores, não sendo permitida a utilização de seus dados privados para treinamento do modelo de inteligência artificial geral.
                <br /><br />
                Nenhum dado é vendido ou compartilhado com terceiros para fins publicitários ou comerciais.
              </p>

              <h4 style={{ color: 'var(--color-text-primary)', marginTop: '20px' }}>4. Armazenamento e Segurança dos Dados</h4>
              <p>
                Os seus perfis, diagnósticos e históricos são mantidos nos servidores da infraestrutura **Supabase**, sob segurança de nível industrial, políticas de controle de acesso rigorosas (Row Level Security - RLS) e criptografia em trânsito e repouso. A sua chave da API do Gemini fica gravada estritamente no localStorage do seu navegador e não é persistida nos nossos bancos de dados na nuvem.
              </p>

              <h4 style={{ color: 'var(--color-text-primary)', marginTop: '20px' }}>5. Seus Direitos (LGPD - Artigo 18)</h4>
              <p>
                Como titular de dados pessoais sob a legislação brasileira, você possui direitos garantidos que podem ser exercidos diretamente no painel de configurações do aplicativo a qualquer momento:
              </p>
              <ul>
                <li><strong>Acesso e Portabilidade:</strong> Você pode exportar uma cópia completa de todos os seus perfis, dados financeiros e conversas salvas na nossa plataforma através do botão <strong>"Exportar Meus Dados"</strong> (formato JSON).</li>
                <li><strong>Exclusão Total ("Direito ao Esquecimento"):</strong> Você pode apagar de forma definitiva todas as informações associadas à sua conta de usuário através do botão <strong>"Excluir Minha Conta e Todos os Dados"</strong> nas configurações. Essa ação é irreversível e remove todos os seus registros de nossos servidores.</li>
                <li><strong>Correção:</strong> Você pode editar os nomes dos perfis e dados financeiros diretamente nas conversas ou no gerenciamento de perfis.</li>
              </ul>

              <h4 style={{ color: 'var(--color-text-primary)', marginTop: '20px' }}>6. Contato e Responsável</h4>
              <p>
                Para quaisquer dúvidas, esclarecimentos ou requisições adicionais de privacidade, por favor contate o suporte ou envie suas observações diretamente no canal de desenvolvimento da plataforma.
              </p>
            </div>
          )}

        </div>

        {/* Footer info/buttons */}
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} className="btn btn-primary">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalModal;
