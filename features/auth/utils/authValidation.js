// the same rules the server uses, checked first so people see the problem before waiting on a request
// each check gives back an error message, or null when the value is fine

const invite_alphabet = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/;

// counts the UTF-8 bytes by hand, since the 72 limit is in bytes and emoji take up to 4
export function utf8Length(text) {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }
  return bytes;
}

export function checkEmail(email) {
  const trimmed = email.trim();
  if (trimmed === '') {
    return 'Enter your email.';
  }
  if (trimmed.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return 'Enter a valid email, like name@example.com.';
  }
  return null;
}

// logging in only needs something typed, the 10 character rule is for new accounts
export function checkLoginPassword(password) {
  return password === '' ? 'Enter your password.' : null;
}

export function checkNewPassword(password) {
  if (password.length < 10) {
    return 'Use at least 10 characters.';
  }
  if (utf8Length(password) > 72) {
    return 'That password is too long.';
  }
  return null;
}

export function checkName(name, required) {
  const trimmed = name.trim();
  if (trimmed === '') {
    return required ? 'Enter your name.' : null;
  }
  if (trimmed.length > 100) {
    return 'Keep the name under 100 characters.';
  }
  return null;
}

// people type codes all sorts of ways, so k7m2-qx9p and "K7M2 QX9P" both become K7M2QX9P
export function normalizeInviteCode(text) {
  return text.toUpperCase().replace(/[\s-]/g, '');
}

export function checkInviteCode(text) {
  const code = normalizeInviteCode(text);
  if (code === '') {
    return 'Enter the invite code from your landlord.';
  }
  if (!invite_alphabet.test(code)) {
    return 'Invite codes are 8 letters and numbers, like K7M2-QX9P.';
  }
  return null;
}

// one place to drop empty results, so a form knows it's good when this comes back empty
export function collectErrors(checks) {
  const errors = {};
  Object.keys(checks).forEach((field) => {
    if (checks[field]) {
      errors[field] = checks[field];
    }
  });
  return errors;
}
