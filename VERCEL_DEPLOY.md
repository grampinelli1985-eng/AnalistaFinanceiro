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

Abra o seu arquivo `.env` local e copie as duas chaves que estão lá. Adicione uma por vez no painel da Vercel:

1. **Nome:** `VITE_SUPABASE_URL`
   **Valor:** (Cole aqui a URL do seu Supabase que começa com https://...)
   Clique em "Add".

2. **Nome:** `VITE_SUPABASE_ANON_KEY`
   **Valor:** (Cole aqui a chave gigante que começa com eyJhb...)
   Clique em "Add".

*Nota: Não é necessário adicionar a chave da API do Claude aqui. Cada usuário vai inserir sua própria chave diretamente na tela do aplicativo, e ela será armazenada apenas no navegador deles.*

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
