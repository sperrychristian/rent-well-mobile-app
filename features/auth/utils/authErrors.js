// assignment 12: the words a sign in or sign up failure shows, for the three auth screens
// an AuthError reads its message from authErrorMessage (never the raw Firebase code), a database error
// (the profile read or write) already has its own plain message, and anything else gets the safe fallback
import { AuthError, authErrorMessage } from '../../../util/auth';
import { serverFieldErrors } from './authValidation';

export function messageForAuthFailure(error) {
  if (error instanceof AuthError) {
    return authErrorMessage(error.code);
  }
  if (error && error.name === 'ApiError' && error.message) {
    return error.message;
  }
  return authErrorMessage('UNKNOWN');
}

// the same failure as { message, field_errors }, the screens keep both in state
export function describeAuthFailure(error) {
  const message = messageForAuthFailure(error);
  return { message: message, field_errors: serverFieldErrors(error && error.code, message) };
}
