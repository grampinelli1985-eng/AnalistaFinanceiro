# Analista Financeiro IA

Assistente de organização financeira pessoal: o usuário conversa com um analista (Google Gemini), que monta o balanço, o diagnóstico e um plano de ação. Os dados ficam no Supabase e as assinaturas são cobradas pelo Asaas.

## Arquitetura

| Camada | Tecnologia | Onde |
|---|---|---|
| Frontend | React 19 + Vite + TypeScript | `src/` |
| API (Vercel Functions) | TypeScript | `api/` (utilitários compartilhados em `api/_lib/`, que não viram rotas) |
| Banco e login | Supabase (Postgres + Auth + RLS) | `api/schema.sql`, `supabase/migrations/` |
| IA | Google Gemini API | chamada só pelo servidor (`api/chat.ts`, `api/process-document.ts`) |
| Pagamentos | Asaas | `api/checkout.ts`, `api/webhook-asaas.ts`, `api/cancel-subscription.ts` |

### Rotas da API

| Rota | Autenticação | Função |
|---|---|---|
| `POST /api/chat` | Login (JWT do Supabase) | Conversa com o analista. Verifica dono do perfil, assinatura, limite diário e rate limit |
| `POST /api/process-document` | Login | Extrai dados de fatura/extrato em PDF (até 3MB) |
| `POST /api/checkout` | Login | Cria a cobrança recorrente no Asaas |
| `POST /api/cancel-subscription` | Login | Cancela a assinatura (Asaas + banco) |
| `POST /api/delete-account` | Login | Exclusão definitiva da conta (LGPD) |
| `POST /api/webhook-asaas` | Token do Asaas + conferência na API do Asaas | Ativa, rebaixa ou cancela assinaturas |
| `GET /api/beta-slots` | Pública | Vagas ocupadas do programa beta |

## Desenvolvimento

```bash
npm install
npm run dev      # frontend em http://localhost:5173
npm test         # testes (Vitest)
npm run lint     # ESLint
npm run build    # checagem de tipos (app + api) e build de produção
```

As rotas de `api/` rodam na Vercel. Para testá-las localmente, use `vercel dev` com as variáveis de ambiente configuradas.

Variáveis de ambiente, banco de dados e webhook: veja [VERCEL_DEPLOY.md](./VERCEL_DEPLOY.md).

## Regras de negócio importantes

- **Acesso ao chat**: trial (90 dias) e `active` liberam; `past_due` tem 3 dias de tolerância; `canceled` e `blocked` bloqueiam.
- **Limite diário**: começa a contar depois que o primeiro balanço do perfil é gerado (`profiles.report_generated_at`, marcado pelo servidor).
- **Plano pago**: só é aplicado quando o webhook confirma o pagamento na API do Asaas. O plano escolhido viaja no `externalReference` da assinatura do Asaas (`<id da assinatura>|<plano>`).
- **Cálculos**: todo o balanço é calculado no frontend (`src/utils/financialCalculations.ts`); a IA só preenche o JSON com os valores informados.
