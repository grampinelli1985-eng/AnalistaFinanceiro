import { describe, it, expect } from 'vitest';
import { evaluateSubscriptionAccess, extractTaggedJson, extractGeminiText, cleanJsonString, PAST_DUE_GRACE_MS } from './server.js';

const now = new Date('2026-10-09T12:00:00Z');
const sub = (status: string, extra: Record<string, string | null> = {}) => ({
  status: status as 'trial',
  trial_ends_at: null,
  updated_at: null,
  created_at: '2026-01-01T00:00:00Z',
  ...extra,
});

describe('evaluateSubscriptionAccess', () => {
  it('libera assinatura ativa', () => {
    expect(evaluateSubscriptionAccess(sub('active'), now)).toEqual({ allowed: true });
  });

  it('libera trial dentro do prazo e bloqueia (persistindo) trial vencido', () => {
    expect(evaluateSubscriptionAccess(sub('trial', { trial_ends_at: '2026-12-01T00:00:00Z' }), now).allowed).toBe(true);
    expect(evaluateSubscriptionAccess(sub('trial', { trial_ends_at: '2026-10-01T00:00:00Z' }), now))
      .toEqual({ allowed: false, reason: 'expired', shouldPersistBlock: true });
  });

  it('dá 3 dias de tolerância para pagamento atrasado', () => {
    const recent = new Date(now.getTime() - PAST_DUE_GRACE_MS + 60_000).toISOString();
    const old = new Date(now.getTime() - PAST_DUE_GRACE_MS - 60_000).toISOString();
    expect(evaluateSubscriptionAccess(sub('past_due', { updated_at: recent }), now).allowed).toBe(true);
    expect(evaluateSubscriptionAccess(sub('past_due', { updated_at: old }), now))
      .toEqual({ allowed: false, reason: 'past_due_expired', shouldPersistBlock: true });
  });

  it('bloqueia cancelada, bloqueada e conta sem assinatura', () => {
    expect(evaluateSubscriptionAccess(sub('canceled'), now)).toMatchObject({ allowed: false, reason: 'canceled' });
    expect(evaluateSubscriptionAccess(sub('blocked'), now)).toMatchObject({ allowed: false, reason: 'blocked' });
    expect(evaluateSubscriptionAccess(null, now)).toMatchObject({ allowed: false, reason: 'blocked' });
  });
});

describe('extração de JSON da IA', () => {
  it('separa o texto visível do bloco de dados', () => {
    const raw = 'Seu balanço está pronto.\n<financial_data>\n```json\n{ "income": { "salary": 5000, }, }\n```\n</financial_data>';
    const { visibleText, json } = extractTaggedJson(raw, 'financial_data');
    expect(visibleText).toBe('Seu balanço está pronto.');
    expect(JSON.parse(json!)).toEqual({ income: { salary: 5000 } });
  });

  it('esconde bloco truncado e devolve json nulo', () => {
    const { visibleText, json } = extractTaggedJson('Texto <financial_data>{ "a": ', 'financial_data');
    expect(visibleText).toBe('Texto');
    expect(json).toBeNull();
  });

  it('não corta URLs nem strings com // ao remover comentários', () => {
    expect(JSON.parse(cleanJsonString('{ "site": "https://exemplo.com" // comentário\n}'))).toEqual({ site: 'https://exemplo.com' });
  });

  it('junta todas as partes de texto e ignora as de raciocínio', () => {
    const data = { candidates: [{ content: { parts: [{ text: 'pensando', thought: true }, { text: 'Olá, ' }, { text: 'tudo bem?' }] } }] };
    expect(extractGeminiText(data)).toBe('Olá, tudo bem?');
    expect(extractGeminiText({})).toBe('');
  });
});
