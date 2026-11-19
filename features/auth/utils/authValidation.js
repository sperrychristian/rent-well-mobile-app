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
// assignment 12: the rule is 8 now (Firebase allows 6, Rent Well asks for a little more)
export const min_password_length = 8;

export function checkLoginPassword(password) {
  return password === '' ? 'Enter your password.' : null;
}

export function checkNewPassword(password) {
  if (password === '') {
    return 'Enter a password.';
  }
  if (password.length < min_password_length) {
    return 'Use at least ' + min_password_length + ' characters.';
  }
  if (utf8Length(password) > 72) {
    return 'That password is too long.';
  }
  return null;
}

// the confirm boxes on sign up, checked only once the first box is fine
export function checkConfirmEmail(email, confirm_email) {
  if (confirm_email.trim() === '') {
    return 'Enter your email again.';
  }
  if (confirm_email.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return "The emails don't match.";
  }
  return null;
}

export function checkConfirmPassword(password, confirm_password) {
  if (confirm_password === '') {
    return 'Enter your password again.';
  }
  if (confirm_password !== password) {
    return "The passwords don't match.";
  }
  return null;
}

// which box a server answer belongs under, so the message shows by the field as well as at the top
export function serverFieldErrors(code, message) {
  const field_for_code = {
    EMAIL_EXISTS: 'email',
    INVALID_EMAIL: 'email',
    EMAIL_TAKEN: 'email',
    WEAK_PASSWORD: 'password',
    INVITE_INVALID: 'invite_code',
  };
  const field = field_for_code[code];
  return field ? { [field]: message } : {};
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
