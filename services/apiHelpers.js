// pure helpers for talking to the backend, no network or storage in here so they're easy to test

// what the app shows for each error code, the server's own message is a fallback since it's not meant for users
const friendly_messages = {
  NO_ACTIVE_TENANCY: 'Your tenancy has ended, so this is read-only now.',
  TENANCY_EXISTS: 'That tenant already lives in that unit.',
  TENANCY_ENDED: 'That tenancy has already ended.',
  INVALID_END_DATE:
    "The move-out date can't be before they moved in or more than 30 days from today.",
  INVITE_USED: 'A tenant already signed up with that invite, so it can no longer be changed.',
  PROPERTY_HAS_ACTIVE_TENANCY:
    'This property still has tenants living there. Move them or end their tenancies first.',
  PROPERTY_HAS_OPEN_WORK_ORDERS:
    'This property still has open work orders. Resolve them first, then delete it.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  EMAIL_TAKEN: 'An account with that email already exists. Try logging in instead.',
  INVITE_INVALID:
    "That invite code doesn't work. It may be used or expired, ask your landlord for a new one.",
  RATE_LIMITED: 'Too many tries. Wait a few minutes and try again.',
  REFRESH_TOKEN_INVALID: 'Your session ended. Please log in again.',
  UNAUTHORIZED: 'Your session ended. Please log in again.',
  FORBIDDEN: "Your account can't do that.",
  NOT_FOUND: "That couldn't be found. It may have been removed.",
  ATTACHMENT_INVALID: "The photo didn't upload. Try attaching it again.",
  PAYLOAD_TOO_LARGE: 'That file is too large.',
  INVALID_CURSOR: "Couldn't load older messages. Pull to refresh and try again.",
  WORK_ORDER_NOT_OPEN: 'Photos can only be added while the request is still open.',
  PHOTO_LIMIT: 'A request can have up to 10 photos.',
  NO_TENANCY: "Your account isn't linked to a rental yet. Ask your landlord for an invite.",
  TENANCY_REQUIRED: 'Pick which rental this request is for.',
  INVALID_STATUS_TRANSITION: "That status change isn't allowed.",
  INTERNAL_ERROR: 'Something went wrong on the server. Try again in a moment.',
  NETWORK_ERROR: "Can't reach the server. Check your connection and try again.",
};

// every error from the api turns into one of these, so screens can read code, message, and field_errors the same way
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details || [];
    // one message per field, so a form can show it right under the box that's wrong
    this.field_errors = {};
    this.details.forEach((detail) => {
      if (detail.path && !this.field_errors[detail.path]) {
        this.field_errors[detail.path] = detail.message;
      }
    });
  }
}

// turns a failed response into an ApiError, the body can be missing or not even JSON when a proxy or crash answers
export function parseApiError(status, body) {
  const error = body && typeof body === 'object' ? body.error : null;
  if (!error || typeof error.code !== 'string') {
    if (status >= 500) {
      return new ApiError(status, 'SERVER_ERROR', friendly_messages.INTERNAL_ERROR);
    }
    return new ApiError(status, 'UNKNOWN_ERROR', 'Something went wrong (error ' + status + ').');
  }

  const details = Array.isArray(error.details) ? error.details : [];
  if (error.code === 'VALIDATION_ERROR') {
    const detail_messages = details.map((detail) => detail.message).filter(Boolean);
    const message =
      detail_messages.length > 0 ? detail_messages.join('\n') : error.message || 'Check the form.';
    return new ApiError(status, error.code, message, details);
  }

  const message = friendly_messages[error.code] || error.message || 'Something went wrong.';
  return new ApiError(status, error.code, message, details);
}

// fetch throws when the server can't be reached at all, this gives that the same shape as a server error
export function networkError() {
  return new ApiError(0, 'NETWORK_ERROR', friendly_messages.NETWORK_ERROR);
}

// wraps an async function so callers that come in while one call is running all share that same call
// the refresh uses this so parallel 401s never send the same refresh token twice
export function createSingleFlight(run) {
  let in_flight = null;
  return function shared() {
    if (!in_flight) {
      in_flight = Promise.resolve()
        .then(run)
        .finally(() => {
          in_flight = null;
        });
    }
    return in_flight;
  };
}

// builds ?a=1&b=2 and skips anything empty, so an unused cursor never gets sent
export function buildQuery(query) {
  if (!query) {
    return '';
  }
  const parts = Object.keys(query)
    .filter((key) => query[key] !== null && query[key] !== undefined && query[key] !== '')
    .map((key) => encodeURIComponent(key) + '=' + encodeURIComponent(String(query[key])));
  return parts.length > 0 ? '?' + parts.join('&') : '';
}
