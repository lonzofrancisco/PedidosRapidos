import { test } from 'node:test';
import assert from 'node:assert/strict';

// El service importa config/db -> config/env, que exige DATABASE_URL/JWT_SECRET.
// Seteamos valores dummy ANTES del import dinamico (el Pool de pg es lazy: no
// conecta hasta que se ejecuta una query, y estos tests solo usan funciones puras).
process.env.DATABASE_URL ||= 'postgres://test:test@localhost:5432/test';
process.env.JWT_SECRET ||= 'test-secret';

const { safeEqual, genTempPassword, computeExtendedPaidUntil } =
  await import('./superadmin.service.js');

const DAY = 86_400_000;

test('safeEqual: strings iguales', () => {
  assert.equal(safeEqual('owner@x.com', 'owner@x.com'), true);
});

test('safeEqual: strings distintos misma longitud', () => {
  assert.equal(safeEqual('abc', 'abd'), false);
});

test('safeEqual: distinta longitud no tira error', () => {
  assert.equal(safeEqual('abc', 'abcd'), false);
});

test('genTempPassword: longitud exacta y sin caracteres ambiguos', () => {
  const p = genTempPassword(10);
  assert.equal(p.length, 10);
  assert.match(p, /^[A-HJ-NP-Za-km-z2-9]+$/); // sin 0 O 1 l I
});

test('computeExtendedPaidUntil: si NO vencio, extiende desde el vencimiento actual', () => {
  const now = new Date('2026-01-15T00:00:00Z');
  const current = new Date('2026-01-20T00:00:00Z'); // vence en 5 dias
  const r = computeExtendedPaidUntil(current.toISOString(), 30, now);
  assert.equal(r.getTime(), current.getTime() + 30 * DAY);
});

test('computeExtendedPaidUntil: si ya vencio, cuenta desde ahora', () => {
  const now = new Date('2026-01-15T00:00:00Z');
  const current = new Date('2026-01-10T00:00:00Z'); // ya vencido
  const r = computeExtendedPaidUntil(current.toISOString(), 30, now);
  assert.equal(r.getTime(), now.getTime() + 30 * DAY);
});

test('computeExtendedPaidUntil: sin paid_until previo, cuenta desde ahora', () => {
  const now = new Date('2026-01-15T00:00:00Z');
  const r = computeExtendedPaidUntil(null, 15, now);
  assert.equal(r.getTime(), now.getTime() + 15 * DAY);
});
