import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePlanInfo } from './plan.js';

const DAY = 86_400_000;
const now = new Date('2026-01-15T00:00:00Z');

test('trial vigente -> activo, no expirado, dias restantes', () => {
  const r = computePlanInfo(
    { plan_status: 'trial', trial_ends_at: new Date(now.getTime() + 5 * DAY), paid_until: null },
    now
  );
  assert.equal(r.status, 'trial');
  assert.equal(r.isActive, true);
  assert.equal(r.isExpired, false);
  assert.equal(r.isTrial, true);
  assert.equal(r.daysLeft, 5);
});

test('trial vencido -> expirado', () => {
  const r = computePlanInfo(
    { plan_status: 'trial', trial_ends_at: new Date(now.getTime() - DAY), paid_until: null },
    now
  );
  assert.equal(r.status, 'expired');
  assert.equal(r.isExpired, true);
  assert.equal(r.isActive, false);
});

test('active vigente -> activo', () => {
  const r = computePlanInfo(
    { plan_status: 'active', trial_ends_at: null, paid_until: new Date(now.getTime() + 30 * DAY) },
    now
  );
  assert.equal(r.status, 'active');
  assert.equal(r.isActive, true);
  assert.equal(r.daysLeft, 30);
});

test('active vencido -> expirado', () => {
  const r = computePlanInfo(
    { plan_status: 'active', trial_ends_at: null, paid_until: new Date(now.getTime() - DAY) },
    now
  );
  assert.equal(r.status, 'expired');
  assert.equal(r.isExpired, true);
});

test('sin fechas -> expirado, daysLeft null', () => {
  const r = computePlanInfo({ plan_status: 'trial', trial_ends_at: null, paid_until: null }, now);
  assert.equal(r.status, 'expired');
  assert.equal(r.isExpired, true);
  assert.equal(r.daysLeft, null);
});
