// the three first-run steps for a new landlord, worked out from data the app already loaded
// pure, so the tests can check every state without a server

// properties and tenants come from useTenants(), invites too, ledgers from useLedger()
// each step: { key, title, done, blocked, hint }, blocked means it can't start yet (no tenant for rent)
export function onboardingSteps(input) {
  const properties = input.properties || [];
  const tenants = input.tenants || [];
  const invites = input.invites || [];
  const ledgers = input.ledgers || [];
  const has_property = properties.length > 0;
  const has_tenant_or_invite = tenants.length > 0 || invites.length > 0;
  const has_rent = ledgers.some((ledger) => !!ledger.schedule);
  const rent_target = rentTarget(ledgers);
  return [
    {
      key: 'property',
      title: 'Add a property',
      done: has_property,
      blocked: false,
      hint: has_property ? 'Done' : 'Where your rentals are',
    },
    {
      key: 'invite',
      title: 'Invite a tenant',
      done: has_tenant_or_invite,
      blocked: !has_property,
      hint: has_tenant_or_invite
        ? 'Done'
        : has_property
          ? 'They sign up with a code'
          : 'Add a property first',
    },
    {
      key: 'rent',
      title: 'Set the rent',
      done: has_rent,
      blocked: !has_rent && !rent_target,
      hint: has_rent
        ? 'Done'
        : rent_target
          ? 'For ' + (rent_target.tenant_name || 'your tenant')
          : 'Once a tenant has joined',
    },
  ];
}

// the tenancy the "Set the rent" step opens the schedule for: the first current one with no rent yet
export function rentTarget(ledgers) {
  return (
    (ledgers || []).find((ledger) => ledger.tenancy_status !== 'ended' && !ledger.schedule) || null
  );
}

// how many are done, as a share from 0 to 1 for the progress line
export function onboardingProgress(steps) {
  if (!steps.length) {
    return 0;
  }
  return steps.filter((step) => step.done).length / steps.length;
}

// the card only shows for a signed-in landlord (never the demo), once their data has loaded,
// and only until they finish every step or hide it for good
export function showsOnboarding(input) {
  if (input.mode !== 'real' || input.role !== 'owner') {
    return false;
  }
  if (!input.ready || input.dismissed !== false) {
    return false;
  }
  return !input.steps.every((step) => step.done);
}
