import {
  utf8Length,
  checkEmail,
  checkLoginPassword,
  checkNewPassword,
  checkName,
  normalizeInviteCode,
  checkInviteCode,
  collectErrors,
} from './authValidation';

describe('authValidation', () => {
  test('utf8Length counts bytes', () => {
    expect(utf8Length('abc')).toBe(3);
    expect(utf8Length('é')).toBe(2);
    expect(utf8Length('€')).toBe(3);
    expect(utf8Length('😀')).toBe(4);
  });

  test('checkEmail', () => {
    expect(checkEmail('')).toMatch(/Enter your email/);
    expect(checkEmail('nope')).toMatch(/valid email/);
    expect(checkEmail(' Tara@Example.com ')).toBeNull();
  });

  test('passwords: login only needs something, new ones need 10 characters and at most 72 bytes', () => {
    expect(checkLoginPassword('')).toMatch(/password/);
    expect(checkLoginPassword('x')).toBeNull();
    expect(checkNewPassword('short')).toMatch(/10/);
    expect(checkNewPassword('long enough')).toBeNull();
    expect(checkNewPassword('a'.repeat(72))).toBeNull();
    expect(checkNewPassword('😀'.repeat(19))).toMatch(/too long/);
  });

  test('checkName', () => {
    expect(checkName('  ', true)).toMatch(/name/);
    expect(checkName('  ', false)).toBeNull();
    expect(checkName('x'.repeat(101), false)).toMatch(/100/);
    expect(checkName(' Tara ', true)).toBeNull();
  });

  test('invite codes ignore case, spaces, and dashes', () => {
    expect(normalizeInviteCode('k7m2-qx9p')).toBe('K7M2QX9P');
    expect(normalizeInviteCode(' K7M2 QX9P ')).toBe('K7M2QX9P');
    expect(checkInviteCode('k7m2-qx9p')).toBeNull();
    expect(checkInviteCode('')).toMatch(/invite code/);
    expect(checkInviteCode('K7M2QX9')).toMatch(/8 letters/);
    // 0, O, 1, I, and L are never used in codes
    expect(checkInviteCode('K7M2QX0P')).toMatch(/8 letters/);
  });

  test('collectErrors keeps only real messages', () => {
    expect(collectErrors({ email: null, password: 'Too short' })).toEqual({
      password: 'Too short',
    });
    expect(collectErrors({ email: null })).toEqual({});
  });
});
