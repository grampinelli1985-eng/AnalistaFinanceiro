# Guia de Deploy na Vercel - Analista Financeiro IA

Este guia vai te ajudar a colocar o seu aplicativo no ar usando a Vercel, de forma segura e rápida.

## Passo 1: Preparar o Repositório
Para que a Vercel consiga publicar o seu site, o código precisa estar em um repositório Git (geralmente no GitHub).
1. Se você não tiver, crie uma conta no [GitHub](https://github.com/).
2. Baixe o [GitHub Desktop](https://desktop.github.com/) (opcional, mas facilita) ou use o terminal para enviar este projeto (`AnalistaFinanceiro`) para um novo repositório privado no GitHub.

## Passo 2: Importar para a Vercel
1. Crie uma conta ou faça login na [Vercel](https://vercel.com/).
2. No painel principal da Vercel, clique no botão preto **"Add New..."** e escolha **"Project"**.
3. Conecte sua conta do GitHub e encontre o repositório que você acabou de criar.
4. Clique em **"Import"**.

## Passo 3: Configurar Variáveis de Ambiente (MUITO IMPORTANTE)
Na tela "Configure Project", antes de clicar em "Deploy", você precisa descer até a seção **"Environment Variables"** (Variáveis de Ambiente).
Aqui é onde conectamos o seu Supabase ao aplicativo na nuvem.

Cadastre as variáveis abaixo (Production e Preview):

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `VITE_SUPABASE_URL` | Sim | URL do projeto Supabase (usada pelo navegador e pelo servidor) |
| `VITE_SUPABASE_ANON_KEY` | Sim | Chave pública do Supabase (navegador) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim | Chave de serviço do Supabase — **só no servidor**, nunca no código do navegador |
| `GEMINI_API_KEY` | Sim | Chave da API do Google Gemini (fica só no servidor) |
| `ASAAS_API_KEY` | Sim | Chave da API do Asaas (pagamentos) |
| `ASAAS_BASE_URL` | Não | Padrão: sandbox (`https://api-sandbox.asaas.com/v3`). Em produção real: `https://api.asaas.com/v3` (com a chave de produção) |
| `ASAAS_WEBHOOK_TOKEN` | Recomendada | Mesmo token configurado no webhook do painel do Asaas; o servidor exige o cabeçalho `asaas-access-token` |
| `GEMINI_MODEL` | Não | Modelo do Gemini (padrão: `gemini-flash-latest`) |
| `ASAAS_MOCK` | Não | `true` simula o gateway de pagamento. **Ignorada em produção.** Use só em desenvolvimento/preview |

*O webhook do Asaas é sempre conferido na API do Asaas antes de liberar um plano — um pagamento só ativa a assinatura se o Asaas confirmar que ele foi recebido.*

## Passo 3.1: Banco de dados (Supabase)
No painel do Supabase, abra **SQL Editor → New query** e execute, nesta ordem:
1. `api/schema.sql` (planos, assinaturas, controle do beta) — se ainda não foi executado.
2. `supabase/migrations/20261009_security_hardening.sql` (RLS, proteção das tabelas de cobrança, rate limit, contador atômico). O script pode ser executado mais de uma vez.

## Passo 3.2: Webhook do Asaas
No painel do Asaas: **Integrações → Webhooks**, URL `https://SEU-DOMINIO/api/webhook-asaas`, com os eventos de cobrança (`PAYMENT_*`) e de assinatura (`SUBSCRIPTION_*`). Preencha o **token de autenticação** com o mesmo valor de `ASAAS_WEBHOOK_TOKEN`.

## Passo 4: Fazer o Deploy
1. Certifique-se de que o "Framework Preset" está como **Vite**.
2. Clique no botão azul **"Deploy"**.
3. Aguarde cerca de 1 a 2 minutos. A Vercel vai instalar tudo e compilar o código.
4. Quando terminar, uma tela de comemoração aparecerá. Você pode clicar no seu novo link (ex: `analista-financeiro.vercel.app`) e começar a usar!

## Passo 5: Autorizar a URL na API do Supabase (Autenticação)
Como o seu site agora tem uma URL oficial da Vercel, o Supabase precisa saber que ela é uma "URL Segura" para permitir os logins.
1. Vá no painel do [Supabase](https://supabase.com/dashboard).
2. Selecione o seu projeto.
3. No menu esquerdo, vá em **Authentication** -> **URL Configuration**.
4. Em **Site URL**, coloque a URL oficial que a Vercel gerou para você (ex: `https://analista-financeiro.vercel.app`).
5. Em **Redirect URLs**, clique em "Add URL" e coloque exatamente a mesma URL (com `/*` no final, ex: `https://analista-financeiro.vercel.app/*`).
6. Salve as configurações.

Pronto! Seu aplicativo está 100% online, seguro e pronto para revolucionar as finanças pessoais!
