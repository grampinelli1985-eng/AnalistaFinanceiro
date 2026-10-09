-- =====================================================================
-- ENDURECIMENTO DE SEGURANÇA — Analista Financeiro IA (09/10/2026)
-- =====================================================================
-- Como aplicar: Supabase Dashboard > SQL Editor > New query > cole tudo > Run.
-- O script é idempotente: pode ser executado mais de uma vez sem efeito colateral.
--
-- O que ele faz:
--   1. Fecha escrita pelo navegador nas tabelas de cobrança (plans, beta_seats,
--      subscriptions, payment_transactions, message_usage). Só o servidor
--      (service role) altera essas tabelas.
--   2. Garante RLS nas tabelas de dados do usuário, criando políticas de dono
--      apenas onde ainda não existe nenhuma política.
--   3. Impede que o navegador altere profiles.report_generated_at (usado no
--      limite diário de mensagens) e profiles.account_id.
--   4. Cria o rate limit por usuário usado por /api/chat e /api/process-document.
--   5. Cria o incremento atômico do contador diário de mensagens.
--   6. Adiciona índices únicos onde não há duplicatas (integridade dos dados).
--   7. Fixa o search_path da função do trigger de novos usuários.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tabelas de cobrança: somente leitura para o navegador
-- ---------------------------------------------------------------------
alter table public.plans enable row level security;
alter table public.beta_seats enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.message_usage enable row level security;

revoke insert, update, delete, truncate on public.plans from anon, authenticated;
revoke insert, update, delete, truncate on public.beta_seats from anon, authenticated;
revoke insert, update, delete, truncate on public.subscriptions from anon, authenticated;
revoke insert, update, delete, truncate on public.payment_transactions from anon, authenticated;
revoke insert, update, delete, truncate on public.message_usage from anon, authenticated;
revoke all on public.beta_seats from anon, authenticated; -- lido só pelo servidor (/api/beta-slots)

-- Catálogo de planos é público (só leitura)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'plans' and policyname = 'Plans are readable by everyone') then
    create policy "Plans are readable by everyone" on public.plans for select using (true);
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 2. RLS nas tabelas de dados do usuário
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.financial_data enable row level security;
alter table public.chat_history enable row level security;
alter table public.monthly_snapshots enable row level security;
alter table public.family_view_config enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles') then
    create policy "Owner manages profiles" on public.profiles
      for all using (account_id = auth.uid()) with check (account_id = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'financial_data') then
    create policy "Owner manages financial_data" on public.financial_data
      for all
      using (exists (select 1 from public.profiles p where p.id = financial_data.profile_id and p.account_id = auth.uid()))
      with check (exists (select 1 from public.profiles p where p.id = financial_data.profile_id and p.account_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'chat_history') then
    create policy "Owner manages chat_history" on public.chat_history
      for all
      using (exists (select 1 from public.profiles p where p.id = chat_history.profile_id and p.account_id = auth.uid()))
      with check (exists (select 1 from public.profiles p where p.id = chat_history.profile_id and p.account_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'monthly_snapshots') then
    create policy "Owner manages monthly_snapshots" on public.monthly_snapshots
      for all
      using (exists (select 1 from public.profiles p where p.id = monthly_snapshots.profile_id and p.account_id = auth.uid()))
      with check (exists (select 1 from public.profiles p where p.id = monthly_snapshots.profile_id and p.account_id = auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'family_view_config') then
    create policy "Owner manages family_view_config" on public.family_view_config
      for all using (account_id = auth.uid()) with check (account_id = auth.uid());
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 3. Campos de profiles controlados só pelo servidor
-- ---------------------------------------------------------------------
create or replace function public.protect_profile_server_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.report_generated_at := null;
    else
      new.report_generated_at := old.report_generated_at;
      new.account_id := old.account_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_server_fields on public.profiles;
create trigger protect_profile_server_fields
  before insert or update on public.profiles
  for each row execute function public.protect_profile_server_fields();


-- ---------------------------------------------------------------------
-- 4. Rate limit por usuário (10 por minuto, 200 por dia)
-- ---------------------------------------------------------------------
create table if not exists public.api_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count int not null default 0,
  primary key (user_id, window_start)
);
alter table public.api_usage enable row level security;
revoke all on public.api_usage from anon, authenticated;

-- Remove a versão anterior (sem parâmetros), se tiver sido criada
drop function if exists public.check_rate_limit();

create or replace function public.check_rate_limit(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  max_per_minute constant int := 10;
  max_per_day constant int := 200;
  minute_count int;
  day_count int;
begin
  if p_user_id is null then
    return false;
  end if;

  insert into api_usage (user_id, window_start, request_count)
  values (p_user_id, date_trunc('minute', now()), 1)
  on conflict (user_id, window_start)
  do update set request_count = api_usage.request_count + 1
  returning request_count into minute_count;

  if minute_count > max_per_minute then
    return false;
  end if;

  select coalesce(sum(request_count), 0) into day_count
  from api_usage
  where user_id = p_user_id and window_start > now() - interval '1 day';

  delete from api_usage
  where user_id = p_user_id and window_start < now() - interval '2 days';

  return day_count <= max_per_day;
end;
$$;

revoke all on function public.check_rate_limit(uuid) from public, anon, authenticated;
grant execute on function public.check_rate_limit(uuid) to service_role;


-- ---------------------------------------------------------------------
-- 5. Incremento atômico do uso diário de mensagens
-- ---------------------------------------------------------------------
create or replace function public.increment_message_usage(p_account_id uuid, p_usage_date date)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into message_usage (account_id, usage_date, message_count)
  values (p_account_id, p_usage_date, 1)
  on conflict (account_id, usage_date)
  do update set message_count = message_usage.message_count + 1
  returning message_count;
$$;

revoke all on function public.increment_message_usage(uuid, date) from public, anon, authenticated;
grant execute on function public.increment_message_usage(uuid, date) to service_role;


-- ---------------------------------------------------------------------
-- 6. Índices únicos (só criados se não houver duplicatas hoje)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.subscriptions group by account_id having count(*) > 1) then
    create unique index if not exists subscriptions_account_id_key on public.subscriptions (account_id);
  else
    raise notice 'subscriptions: há contas com mais de uma assinatura — índice único NÃO criado.';
  end if;

  if not exists (select 1 from public.payment_transactions where gateway_transaction_id is not null group by gateway_transaction_id having count(*) > 1) then
    create unique index if not exists payment_transactions_gateway_id_key
      on public.payment_transactions (gateway_transaction_id) where gateway_transaction_id is not null;
  else
    raise notice 'payment_transactions: há transações duplicadas — índice único NÃO criado.';
  end if;

  if not exists (select 1 from public.financial_data group by profile_id having count(*) > 1) then
    create unique index if not exists financial_data_profile_id_key on public.financial_data (profile_id);
  else
    raise notice 'financial_data: há perfis com mais de um registro — índice único NÃO criado.';
  end if;

  if not exists (select 1 from public.chat_history group by profile_id having count(*) > 1) then
    create unique index if not exists chat_history_profile_id_key on public.chat_history (profile_id);
  else
    raise notice 'chat_history: há perfis com mais de um histórico — índice único NÃO criado.';
  end if;

  if not exists (select 1 from public.monthly_snapshots group by profile_id, month having count(*) > 1) then
    create unique index if not exists monthly_snapshots_profile_month_key on public.monthly_snapshots (profile_id, month);
  else
    raise notice 'monthly_snapshots: há snapshots duplicados — índice único NÃO criado.';
  end if;
end $$;


-- ---------------------------------------------------------------------
-- 7. Trigger de novos usuários com search_path fixo
-- ---------------------------------------------------------------------
alter function public.handle_new_user_subscription() set search_path = public;


-- ---------------------------------------------------------------------
-- Conferência (opcional): rode depois para revisar as políticas existentes
-- ---------------------------------------------------------------------
-- select tablename, policyname, cmd, roles, qual, with_check
-- from pg_policies where schemaname = 'public' order by tablename, policyname;
