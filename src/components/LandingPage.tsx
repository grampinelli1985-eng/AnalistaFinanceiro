import React, { useState, useEffect, useRef } from 'react';
import '../LandingPage.css';

interface LandingPageProps {
  onLoginClick: (planId?: 'basic' | 'family') => void;
}

const faqs = [
  {
    q: 'Preciso conectar minha conta bancária ou informar senhas?',
    a: 'Não. O Analista IA trabalha apenas com as informações que você digitar no chat — valores de renda, gastos e dívidas. Nenhuma credencial bancária é solicitada ou armazenada.'
  },
  {
    q: 'Meus dados financeiros ficam seguros?',
    a: 'Sim. Todos os dados são armazenados com criptografia e protegidos por autenticação. Cada perfil tem acesso exclusivo às suas próprias informações — nenhum outro usuário pode ver seus dados.'
  },
  {
    q: 'Quanto tempo leva o diagnóstico?',
    a: 'Em média 5 a 10 minutos de conversa com a IA. Ela faz as perguntas certas e você responde no seu ritmo.'
  },
  {
    q: 'Funciona para quem está negativado ou com nome sujo?',
    a: 'Sim, e é exatamente para essa situação que o Analista IA foi desenvolvido. Ele não julga — ele analisa e propõe um plano de saída.'
  },
  {
    q: 'Posso usar para organizar as finanças da minha família?',
    a: 'Sim. O sistema suporta até 3 perfis familiares independentes (você, cônjuge, dependente), cada um com seu próprio histórico. Há também uma visão consolidada familiar disponível após ambos os perfis concluírem a análise individual.'
  },
  {
    q: 'O serviço é realmente gratuito?',
    a: 'Durante o período Beta, as primeiras 50 vagas têm acesso 100% gratuito por 90 dias. Não é exigido cartão de crédito para testar.'
  }
];

const featuresList = [
  { icon: '🧠', title: 'Chat Contextual Avançado', text: 'A inteligência artificial não apenas responde, ela pergunta. O Analista IA é treinado para extrair as informações certas e montar seu quebra-cabeça financeiro.' },
  { icon: '📉', title: 'Gestão Implacável de Dívidas', text: 'Descubra exatamente quanto você paga de juros e receba a recomendação ideal entre o "Método Avalanche" (matar juros altos) ou "Bola de Neve" (vitórias rápidas).' },
  { icon: '🛡️', title: 'Reserva de Emergência Blindada', text: 'Saber que você precisa de reserva é fácil. Nossa IA calcula os "meses de cobertura" exatos do seu padrão de vida atual e define o alvo milimétrico para a sua segurança.' },
  { icon: '📄', title: 'Dossiê Imprimível em PDF', text: 'Gere na hora um relatório completo com prós e contras da sua saúde financeira. Um checklist tático que você pode imprimir e colar na porta da geladeira.' },
  { icon: '👥', title: 'Perfis Multi-usuário (Família)', text: 'Crie perfis independentes para sua esposa, marido ou filhos. Cada um tem seu próprio consultor e sigilo, mas permite um planejamento familiar conjunto.' },
  { icon: '☁️', title: 'Sincronização em Tempo Real', text: 'Seus dados viajam com você. Acesse do celular, do tablet ou do computador. O histórico da sua evolução financeira está sempre seguro na nuvem.' },
];

const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick }) => {
  const [isSticky, setIsSticky] = useState(false);
  const [showExitPopup, setShowExitPopup] = useState(false);
  const [betaSlotsUsed, setBetaSlotsUsed] = useState<number | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [exitEmail, setExitEmail] = useState('');
  const [exitSuccess, setExitSuccess] = useState(false);
  const [currentFeatureSlide, setCurrentFeatureSlide] = useState(0);
  const [isHoveringCarousel, setIsHoveringCarousel] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Busca a contagem REAL de perfis cadastrados, para mostrar a ocupação
  // verdadeira do Beta (não um número fictício). Se a chamada falhar por
  // qualquer motivo, betaSlotsUsed permanece null e a seção de vagas é
  // simplesmente ocultada — nunca mostramos um número inventado.
  useEffect(() => {
    fetch('/api/beta-slots')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.count === 'number') {
          setBetaSlotsUsed(data.count);
        }
      })
      .catch(() => {
        // Falha silenciosa — a seção de vagas simplesmente não aparece
      });
  }, []);

  const nextFeature = () => {
    setCurrentFeatureSlide((prev) => (prev + 1) % featuresList.length);
  };

  const prevFeature = () => {
    setCurrentFeatureSlide((prev) => (prev - 1 + featuresList.length) % featuresList.length);
  };

  const getFeatureCardClass = (index: number) => {
    if (index === currentFeatureSlide) return 'carousel-card active';
    if (index === (currentFeatureSlide - 1 + featuresList.length) % featuresList.length) return 'carousel-card prev';
    if (index === (currentFeatureSlide + 1) % featuresList.length) return 'carousel-card next';
    return 'carousel-card hidden';
  };

  // Scroll logic for sticky navbar
  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current && containerRef.current.scrollTop > 600) {
        setIsSticky(true);
      } else {
        setIsSticky(false);
      }
    };

    const el = containerRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll);
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Exit intent logic
  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        const hasShown = localStorage.getItem('exitIntentShown');
        if (!hasShown) {
          setShowExitPopup(true);
          localStorage.setItem('exitIntentShown', 'true');
        }
      }
    };

    // Delay 3 seconds before activating exit intent
    const timer = setTimeout(() => {
      document.addEventListener('mouseleave', handleMouseLeave);
    }, 3000);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Carousel autoplay logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (!isHoveringCarousel) {
      interval = setInterval(() => {
        setCurrentFeatureSlide((prev) => (prev + 1) % featuresList.length);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isHoveringCarousel]);

  const handleExitSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (exitEmail) {
      // Mock Supabase save lead
      console.log('Lead salvo:', exitEmail);
      setExitSuccess(true);
      setTimeout(() => {
        setShowExitPopup(false);
      }, 3000);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const slotsPercentage = betaSlotsUsed !== null ? Math.min((betaSlotsUsed / 50) * 100, 100) : 0;
  const isSlotsCritical = betaSlotsUsed !== null && slotsPercentage >= 70;

  return (
    <div className="landing-container" ref={containerRef}>
      {/* Background */}
      <div className="profile-bg-orb profile-bg-orb-1" />
      <div className="profile-bg-orb profile-bg-orb-2" />
      <div className="landing-grid-bg" />

      {/* Header */}
      <header className={`landing-header ${isSticky ? 'sticky' : ''}`}>
        <div className="landing-logo">
          <span className="logo-icon" style={{ animation: 'logoGlow 2s ease-in-out infinite alternate' }}>🤖</span>
          <span className="logo-text">Analista Financeiro IA</span>
        </div>
        <div className="landing-nav">
          <button onClick={() => onLoginClick()} className="btn btn-primary landing-login-btn">
            {isSticky ? 'Garantir Vaga Gratuita →' : 'Acessar Plataforma'}
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">Chega de planilhas chatas 👋</div>
          <h1 className="hero-title">
            Assuma o controle das suas finanças com <span className="text-gradient">Inteligência Artificial</span>.
          </h1>
          <p className="hero-subtitle">
            Converse com sua IA financeira e descubra, em minutos, para onde seu dinheiro está realmente indo. Obtenha um plano claro para quitar dívidas, criar reserva e começar a investir — sem planilha, sem complicação.
          </p>
          <div className="hero-actions">
            <button onClick={() => onLoginClick()} className="btn btn-primary hero-btn">
              Começar Diagnóstico Gratuito
            </button>
            <a href="#how-it-works" className="btn hero-btn-outline">
              Como Funciona
            </a>
          </div>

          {/* Social Proof Hero */}
          <div className="hero-social-proof">
            <span>🚀 Programa Beta gratuito — seja um dos primeiros a usar</span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="mockup-card floating-animation">
            <div className="mockup-header">
              <div className="mockup-dots">
                <span className="dot dot-red"></span>
                <span className="dot dot-yellow"></span>
                <span className="dot dot-green"></span>
              </div>
              <div className="mockup-title">Seu Plano de Ação Personalizado</div>
            </div>
            <div className="mockup-body">
              <div className="mockup-chat-bubble mockup-chat-ai">
                <strong>Analista IA:</strong> Analisei seus gastos deste mês. Percebi que 35% da sua renda foi para aplicativos de entrega. Se reduzirmos isso pela metade, você quita sua dívida do cartão 3 meses antes do previsto. Topa o desafio?
              </div>
              <div className="mockup-chat-bubble mockup-chat-user">
                Uau, não tinha percebido! Vamos fazer isso.
              </div>
              <div className="mockup-alert">
                <span style={{ marginRight: 8 }}>✅</span> Nova meta de economia ativada!
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="trust-badges-section">
        <div className="trust-badge"><span className="trust-icon">🔒</span> Dados criptografados</div>
        <div className="trust-badge"><span className="trust-icon">🇧🇷</span> 100% em português</div>
        <div className="trust-badge"><span className="trust-icon">⚡</span> Diagnóstico em minutos</div>
        <div className="trust-badge"><span className="trust-icon">👨‍👩‍👧</span> Suporte familiar</div>
      </section>

      {/* Problem vs Solution Section */}
      <section className="problem-solution-section">
        <div className="ps-container">
          <div className="ps-card ps-problem">
            <h3>O Jeito Antigo 👎</h3>
            <ul className="ps-list-problem">
              <li>Preencher planilhas manualmente até desistir.</li>
              <li>Não saber qual dívida pagar primeiro.</li>
              <li>Tentar poupar dinheiro sem um alvo claro.</li>
              <li>Sentir culpa por gastos que você nem lembra.</li>
              <li>Estar sempre no escuro sobre o futuro financeiro.</li>
            </ul>
          </div>
          <div className="ps-card ps-solution">
            <h3>O Jeito Analista IA 🚀</h3>
            <ul className="ps-list-solution">
              <li>Conversa natural: basta mandar áudio ou texto.</li>
              <li>A IA calcula os juros e cria o melhor plano de quitação.</li>
              <li>Metas de reserva calculadas com base no seu custo de vida.</li>
              <li>Insights que revelam padrões invisíveis nos seus gastos.</li>
              <li>Clareza total e um relatório em PDF de fácil leitura.</li>
            </ul>
          </div>
        </div>
        <div className="ps-cta-container">
          <button onClick={() => onLoginClick()} className="btn ps-mini-cta">Quero o Jeito Analista IA →</button>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="steps-section">
        <div className="section-header">
          <h2>O caminho para a paz financeira</h2>
          <p>Esqueça os jargões difíceis. Nós desenhamos um processo simples e direto ao ponto.</p>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Converse</h3>
            <span className="step-time">⏱ ~5 min</span>
            <p>Conte para a IA sobre sua renda, gastos fixos e dívidas como se estivesse falando com um amigo de confiança.</p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h3>Diagnóstico</h3>
            <span className="step-time">⏱ 30 segundos</span>
            <p>O algoritmo processa seus dados em segundos, encontrando gargalos e oportunidades de economia que você não via.</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Plano de Ação</h3>
            <span className="step-time">⏱ Imediato</span>
            <p>Receba um PDF com um checklist claro em 4 fases: Estabilização, Quitação, Reserva e Investimento.</p>
          </div>
          <div className="step-card">
            <div className="step-number">4</div>
            <h3>Acompanhamento</h3>
            <span className="step-time">⏱ Mensal</span>
            <p>A cada mês, o Analista IA revisa seu progresso, compara com o mês anterior e ajusta o plano automaticamente conforme sua realidade muda.</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="section-header">
          <h2>Um arsenal completo contra o descontrole</h2>
          <p>Tudo o que você precisa para sair do vermelho e começar a multiplicar seu patrimônio.</p>
        </div>

        <div
          className="carousel-wrapper"
          onMouseEnter={() => setIsHoveringCarousel(true)}
          onMouseLeave={() => setIsHoveringCarousel(false)}
        >
          <button className="carousel-arrow left" onClick={prevFeature}>&lt;</button>

          <div className="carousel-container">
            {featuresList.map((feature, index) => (
              <div
                key={index}
                className={getFeatureCardClass(index)}
                onClick={() => {
                  if (getFeatureCardClass(index).includes('prev')) prevFeature();
                  if (getFeatureCardClass(index).includes('next')) nextFeature();
                }}
              >
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
            ))}
          </div>

          <button className="carousel-arrow right" onClick={nextFeature}>&gt;</button>
        </div>

        <div className="carousel-dots">
          {featuresList.map((_, index) => (
            <button
              key={index}
              className={`carousel-dot ${index === currentFeatureSlide ? 'active' : ''}`}
              onClick={() => setCurrentFeatureSlide(index)}
            />
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials-section">
        <h2>Por que confiar no Analista IA?</h2>
        <div className="testimonials-grid">
          <div className="testimonial-card">
            <div className="testimonial-header">
              <div className="testimonial-avatar" style={{ background: '#8b5cf6' }}>🔍</div>
              <div>
                <div className="testimonial-author">Transparência desde o início</div>
              </div>
            </div>
            <p>Somos um produto novo, em fase Beta. Não temos centenas de depoimentos ainda — preferimos ser honestos sobre isso do que inventar números. O que oferecemos é uma metodologia clara: cálculo real de juros, comprometimento de renda e plano de quitação baseado nos seus dados.</p>
          </div>
          <div className="testimonial-card">
            <div className="testimonial-header">
              <div className="testimonial-avatar" style={{ background: '#3b82f6' }}>🧮</div>
              <div>
                <div className="testimonial-author">Matemática, não promessa vazia</div>
              </div>
            </div>
            <p>Cada recomendação é baseada em cálculos financeiros verificáveis — taxa de juros, índice de comprometimento de renda, métodos consagrados de quitação de dívidas (Avalanche e Bola de Neve). Sem fórmulas mágicas.</p>
          </div>
          <div className="testimonial-card">
            <div className="testimonial-header">
              <div className="testimonial-avatar" style={{ background: '#059669' }}>🔒</div>
              <div>
                <div className="testimonial-author">Seus dados, sua privacidade</div>
              </div>
            </div>
            <p>Não pedimos acesso à sua conta bancária nem senhas. Você só informa o que quiser, no seu ritmo, e os dados ficam protegidos e visíveis apenas para você.</p>
          </div>
        </div>
      </section>

      {/* Before & After Section */}
      <section className="before-after-section">
        <div className="section-header">
          <h2>Exemplo: de R$18.000 em dívidas a R$900/mês investidos</h2>
          <p>Veja, de forma ilustrativa, como a metodologia do Analista IA estrutura essa transformação ao longo de 6 meses.</p>
        </div>
        <div className="ba-container">
          <div className="ba-card ba-before">
            <div className="ba-label">Situação inicial</div>
            <div className="ba-icon">⚠️</div>
            <ul className="ba-stats">
              <li><span>Dívida total:</span> R$ 18.400</li>
              <li><span>Comprometimento da renda:</span> 94%</li>
              <li><span>Reserva de emergência:</span> R$ 0</li>
              <li><span>Status:</span> Sem plano definido</li>
            </ul>
          </div>
          <div className="ba-card ba-after">
            <div className="ba-label">Após 6 meses de plano</div>
            <div className="ba-icon">✓</div>
            <ul className="ba-stats">
              <li><span>Dívida restante:</span> R$ 6.200 (−66%)</li>
              <li><span>Comprometimento da renda:</span> 61%</li>
              <li><span>Reserva de emergência:</span> R$ 2.100</li>
              <li><span>Status:</span> Fase 2 — Quitação acelerada</li>
            </ul>
          </div>
        </div>
        <p style={{ textAlign: 'center', fontSize: '0.8rem', opacity: 0.6, marginTop: '8px', marginBottom: '24px' }}>
          *Exemplo ilustrativo da metodologia, não um resultado garantido. Seus resultados dependem da sua situação financeira real.
        </p>
        <div className="ba-cta">
          <button onClick={() => onLoginClick()} className="btn btn-primary hero-btn">
            Quero montar meu plano →
          </button>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section">
        <h2>Dúvidas frequentes</h2>
        <div className="faq-container">
          {faqs.map((faq, index) => (
            <div className={`faq-item ${openFaqIndex === index ? 'open' : ''}`} key={index}>
              <button className="faq-question" onClick={() => toggleFaq(index)}>
                {faq.q}
                <span className="faq-icon">{openFaqIndex === index ? '−' : '+'}</span>
              </button>
              <div className="faq-answer">
                <p>{faq.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing / CTA Section */}
      <section className="pricing-section">
        <div className="pricing-content">
          <h2>Sua independência financeira está a um clique de distância</h2>
          <p>
            Escolha o melhor plano para iniciar sua jornada de organização. Comece agora mesmo e assuma o controle.
          </p>
          <div className="pricing-grid">
            {/* Plano Beta — Ocultado automaticamente se as 50 vagas estiverem esgotadas */}
            {(betaSlotsUsed === null || betaSlotsUsed < 50) && (
              <div className="pricing-card">
                <div className="pricing-header">
                  <h3>Plano Beta</h3>
                  <div className="price" style={{ fontSize: '2.8rem' }}>Grátis<span>/90 dias de trial</span></div>
                </div>

                {betaSlotsUsed !== null ? (
                  <div className="slots-container" style={{ margin: '1rem 0' }}>
                    <div className="slots-text">
                      <strong>{betaSlotsUsed}</strong> de 50 vagas preenchidas
                    </div>
                    <div className="slots-bar-bg">
                      <div
                        className={`slots-bar-fill ${isSlotsCritical ? 'critical' : ''}`}
                        style={{ width: `${slotsPercentage}%` }}
                      ></div>
                    </div>
                    {isSlotsCritical && <div className="slots-warning">Restam poucas vagas!</div>}
                  </div>
                ) : (
                  <div className="slots-container" style={{ margin: '1rem 0' }}>
                    <div className="slots-text">Acesso gratuito temporário</div>
                  </div>
                )}

                <ul className="pricing-features" style={{ margin: '1rem 0 var(--space-md)' }}>
                  <li>✅ 1 Perfil Individual</li>
                  <li>✅ Diagnósticos e Plano de Ação</li>
                  <li>✅ Dossiê Completo em PDF</li>
                  <li>✅ Limite: 20 msgs/dia pós-relatório</li>
                </ul>
                <button onClick={() => onLoginClick()} className="btn btn-primary pricing-btn">
                  Garantir Teste Gratuito
                </button>
                <p className="pricing-note">Exclusivo para os 50 primeiros cadastros.</p>
              </div>
            )}

            {/* Plano Basic */}
            <div className="pricing-card">
              <div className="pricing-header">
                <h3>Plano Basic</h3>
                <div className="price" style={{ fontSize: '2.8rem' }}>R$ 59,90<span>/ano</span></div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '-10px 0 15px 0' }}>ou até 6x no cartão de crédito</p>

              <ul className="pricing-features" style={{ margin: '1.5rem 0' }}>
                <li>✅ 1 Perfil Individual</li>
                <li>✅ Diagnósticos e Metas por IA</li>
                <li>✅ Dossiê Completo em PDF</li>
                <li>✅ Limite: 40 msgs/dia pós-relatório</li>
                <li>✅ Sincronização segura na nuvem</li>
              </ul>
              <button onClick={() => onLoginClick('basic')} className="btn btn-primary pricing-btn">
                Começar Plano Basic
              </button>
              <p className="pricing-note">Ideal para organização financeira pessoal.</p>
            </div>

            {/* Plano Family */}
            <div className="pricing-card featured">
              <div className="pricing-badge">Mais Popular</div>
              <div className="pricing-header">
                <h3>Plano Family</h3>
                <div className="price" style={{ fontSize: '2.8rem', color: 'var(--color-accent)' }}>R$ 79,90<span>/ano</span></div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: '-10px 0 15px 0' }}>ou até 10x no cartão de crédito</p>

              <ul className="pricing-features" style={{ margin: '1.5rem 0' }}>
                <li>✅ Até 3 Perfis Familiares</li>
                <li>✅ Painel Consolidado Familiar</li>
                <li>✅ Diagnósticos e Metas por IA</li>
                <li>✅ Limite: 100 msgs/dia (pool compartilhado)</li>
                <li>✅ Dossiê Completo em PDF para todos</li>
              </ul>
              <button onClick={() => onLoginClick('family')} className="btn btn-primary pricing-btn" style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, #4f46e5 100%)' }}>
                Começar Plano Family
              </button>
              <p className="pricing-note">A melhor escolha para planejar em família.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="footer-logo">🤖 Analista Financeiro IA</div>
            <p>Transformando ansiedade financeira em clareza, um chat por vez.</p>
          </div>
          <div className="footer-links">
            <div className="link-group">
              <h4>Produto</h4>
              <a href="#how-it-works">Como Funciona</a>
              <a href="#features">Recursos</a>
              <a href="#">Preços</a>
            </div>
            <div className="link-group">
              <h4>Legal</h4>
              <a href="/termos-de-uso.html" target="_blank" rel="noopener noreferrer">Termos de Uso</a>
              <a href="/politica-de-privacidade.html" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Analista Financeiro IA. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* Exit Intent Popup */}
      {showExitPopup && (
        <div className="exit-popup-overlay">
          <div className="exit-popup">
            <button className="exit-popup-close" onClick={() => setShowExitPopup(false)}>✕</button>
            {exitSuccess ? (
              <div className="exit-popup-success">
                <div className="success-icon">✅</div>
                <h3>E-mail cadastrado!</h3>
                <p>Enviaremos novidades sobre o diagnóstico gratuito.</p>
              </div>
            ) : (
              <>
                <h3>Antes de sair...</h3>
                <p>Você está a 1 passo de descobrir exatamente para onde seu dinheiro está indo. Quer receber o diagnóstico gratuito no seu e-mail?</p>
                <form onSubmit={handleExitSubmit} className="exit-form">
                  <input
                    type="email"
                    placeholder="Seu melhor e-mail"
                    required
                    value={exitEmail}
                    onChange={(e) => setExitEmail(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary">Sim, quero o diagnóstico →</button>
                </form>
                <button className="exit-popup-secondary" onClick={() => setShowExitPopup(false)}>
                  Não, prefiro continuar no escuro
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
