-- ========================================================
-- SCHEMA DE MONETIZAÇÃO, PLANOS E RETENÇÃO DE USUÁRIOS
-- ========================================================

-- 1. Tabela de Planos (Catálogo)
CREATE TABLE IF NOT EXISTS public.plans (
  id TEXT PRIMARY KEY, -- 'beta' | 'basic' | 'family'
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  max_profiles INTEGER NOT NULL,
  max_messages_post_report INTEGER NOT NULL,
  billing_cycle TEXT NOT NULL -- 'trial_90d' | 'annual'
);

-- Inserir os planos padrão
INSERT INTO public.plans (id, name, price_cents, max_profiles, max_messages_post_report, billing_cycle)
VALUES
  ('beta', 'Beta Trial', 0, 1, 20, 'trial_90d'),
  ('basic', 'Plano Basic', 5990, 1, 40, 'annual'),
  ('family', 'Plano Family', 7990, 3, 100, 'annual')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  max_profiles = EXCLUDED.max_profiles,
  max_messages_post_report = EXCLUDED.max_messages_post_report,
  billing_cycle = EXCLUDED.billing_cycle;

-- 2. Tabela de Assinaturas (Subscriptions)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.plans(id),
  status TEXT NOT NULL, -- 'trial' | 'active' | 'past_due' | 'canceled' | 'blocked'
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  gateway TEXT, -- 'asaas'
  gateway_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar índice para busca rápida por account_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_account_id ON public.subscriptions(account_id);

-- Habilitar RLS em subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = account_id);

-- 3. Tabela de Controle de Vagas do BETA (Lock Atômico)
CREATE TABLE IF NOT EXISTS public.beta_seats (
  id INT PRIMARY KEY DEFAULT 1,
  seats_taken INT NOT NULL DEFAULT 0,
  seats_limit INT NOT NULL DEFAULT 50,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Inicializar o controle de vagas se não existir
INSERT INTO public.beta_seats (id, seats_taken, seats_limit)
VALUES (1, 0, 50)
ON CONFLICT (id) DO NOTHING;

-- 4. Tabela de Uso Diário de Mensagens (Pós-Relatório)
CREATE TABLE IF NOT EXISTS public.message_usage (
  account_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (account_id, usage_date)
);

-- Habilitar RLS em message_usage
ALTER TABLE public.message_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own message usage"
  ON public.message_usage
  FOR SELECT
  USING (auth.uid() = account_id);

-- 5. Tabela de Transações de Pagamento
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  gateway_transaction_id TEXT,
  method TEXT NOT NULL, -- 'pix' | 'boleto' | 'cartao'
  installments INTEGER DEFAULT 1,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL, -- 'pending' | 'paid' | 'failed' | 'refunded'
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS em payment_transactions
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
  ON public.payment_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = public.payment_transactions.subscription_id AND s.account_id = auth.uid()
    )
  );

-- 6. Adicionar coluna report_generated_at na tabela profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS report_generated_at TIMESTAMPTZ;

-- 7. Função de Trigger para Novo Usuário Registrado (Gerenciamento Atômico)
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
DECLARE
  beta_limit INT;
  beta_taken INT;
  assigned_plan TEXT;
  sub_status TEXT;
  trial_start TIMESTAMPTZ := NULL;
  trial_end TIMESTAMPTZ := NULL;
BEGIN
  -- Lock the seats row to prevent race conditions
  SELECT seats_limit, seats_taken INTO beta_limit, beta_taken
  FROM public.beta_seats
  WHERE id = 1
  FOR UPDATE;

  IF beta_taken < beta_limit THEN
    -- Increment the seats
    UPDATE public.beta_seats
    SET seats_taken = seats_taken + 1
    WHERE id = 1;
    
    assigned_plan := 'beta';
    sub_status := 'trial';
    trial_start := now();
    trial_end := now() + interval '90 days';
  ELSE
    assigned_plan := 'basic'; -- fallback plan, needs payment
    sub_status := 'blocked'; -- blocked until payment
  END IF;

  INSERT INTO public.subscriptions (account_id, plan_id, status, trial_started_at, trial_ends_at)
  VALUES (NEW.id, assigned_plan, sub_status, trial_start, trial_end);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar o Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- Atualizar vagas preenchidas retroativamente se houver usuários legados
UPDATE public.beta_seats
SET seats_taken = LEAST((SELECT COUNT(*) FROM auth.users), seats_limit)
WHERE id = 1;
