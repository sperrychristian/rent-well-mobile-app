import { onboardingSteps, rentTarget, onboardingProgress, showsOnboarding } from './onboarding';

const ledger = (extra) => ({
  tenancy_id: 't1',
  tenancy_status: 'active',
  tenant_name: 'Tara Tenant',
  schedule: null,
  ...(extra || {}),
});

describe('onboarding steps', () => {
  test('a brand new landlord has nothing done, and the later steps wait on the earlier ones', () => {
    const steps = onboardingSteps({});
    expect(steps.map((step) => [step.key, step.done, step.blocked])).toEqual([
      ['property', false, false],
      ['invite', false, true],
      ['rent', false, true],
    ]);
    expect(steps[1].hint).toBe('Add a property first');
    expect(steps[2].hint).toBe('Once a tenant has joined');
    expect(onboardingProgress(steps)).toBe(0);
  });

  test('a property and a pending invite finish two, rent waits for the tenant to join', () => {
    const steps = onboardingSteps({ properties: [{ id: 'p' }], invites: [{ id: 'i' }] });
    expect(steps.map((step) => step.done)).toEqual([true, true, false]);
    expect(steps[2].blocked).toBe(true);
    expect(onboardingProgress(steps)).toBeCloseTo(2 / 3);
  });

  test('once a tenant has a ledger with no schedule, rent opens for them', () => {
    const steps = onboardingSteps({
      properties: [{ id: 'p' }],
      tenants: [{ id: 'u' }],
      ledgers: [ledger({ tenancy_status: 'ended', tenancy_id: 'old' }), ledger()],
    });
    expect(steps[2]).toMatchObject({ done: false, blocked: false, hint: 'For Tara Tenant' });
    expect(rentTarget([ledger({ tenancy_status: 'ended' })])).toBeNull();
    expect(rentTarget([ledger()]).tenancy_id).toBe('t1');
  });

  test('any ledger with a schedule finishes the rent step', () => {
    const steps = onboardingSteps({
      properties: [{ id: 'p' }],
      tenants: [{ id: 'u' }],
      ledgers: [ledger({ schedule: { amount_cents: 1 } })],
    });
    expect(steps.every((step) => step.done)).toBe(true);
    expect(onboardingProgress(steps)).toBe(1);
  });
});

describe('when the card shows', () => {
  const steps = onboardingSteps({});
  const base = { mode: 'real', role: 'owner', ready: true, dismissed: false, steps };

  test('a real landlord with steps left sees it', () => {
    expect(showsOnboarding(base)).toBe(true);
  });

  test('never in the demo, never for a tenant, not before loading, not once hidden or done', () => {
    expect(showsOnboarding({ ...base, mode: 'demo' })).toBe(false);
    expect(showsOnboarding({ ...base, role: 'tenant' })).toBe(false);
    expect(showsOnboarding({ ...base, ready: false })).toBe(false);
    expect(showsOnboarding({ ...base, dismissed: true })).toBe(false);
    // still reading whether it was hidden, so it doesn't flash
    expect(showsOnboarding({ ...base, dismissed: null })).toBe(false);
    const done = onboardingSteps({
      properties: [{ id: 'p' }],
      tenants: [{ id: 'u' }],
      ledgers: [ledger({ schedule: {} })],
    });
    expect(showsOnboarding({ ...base, steps: done })).toBe(false);
  });
});
