import { isPending, pendingInvites, formatInviteCode, inviteShareText } from './inviteHelpers';

const now = new Date('2026-10-11T12:00:00.000Z');
const base = {
  id: 'i1',
  code: 'K7M2QX9P',
  propertyId: 'p1',
  unitLabel: 'Unit 2B',
  tenantName: 'Tara Tenant',
  expiresAt: '2026-10-18T12:00:00.000Z',
  usedAt: null,
  createdAt: '2026-10-11T12:00:00.000Z',
};

describe('inviteHelpers', () => {
  test('pending means unused and not expired', () => {
    expect(isPending(base, now)).toBe(true);
    expect(isPending({ ...base, usedAt: '2026-10-12T00:00:00.000Z' }, now)).toBe(false);
    expect(isPending({ ...base, expiresAt: '2026-10-11T11:59:59.000Z' }, now)).toBe(false);
    expect(pendingInvites([base, { ...base, id: 'i2', usedAt: 'x' }], now)).toHaveLength(1);
  });

  test('the status from the server wins, so revoked and used ones are never pending', () => {
    expect(isPending({ ...base, status: 'pending' }, now)).toBe(true);
    expect(isPending({ ...base, status: 'revoked', revokedAt: 'x' }, now)).toBe(false);
    expect(isPending({ ...base, status: 'used' }, now)).toBe(false);
    // a pending one that ran out since it was loaded counts as expired
    expect(
      isPending({ ...base, status: 'pending', expiresAt: '2026-10-11T11:00:00.000Z' }, now),
    ).toBe(false);
  });

  test('codes are shown with a dash in the middle', () => {
    expect(formatInviteCode('K7M2QX9P')).toBe('K7M2-QX9P');
    expect(formatInviteCode('ABC')).toBe('ABC');
  });

  test('share text has the code, property, unit, and expiry date', () => {
    const text = inviteShareText(base, 'Maple Court');
    expect(text).toContain('K7M2-QX9P');
    expect(text).toContain('Maple Court, Unit 2B');
    expect(text).toContain('2026-10-18');
  });
});
