import {
  parseApiError,
  networkError,
  createSingleFlight,
  buildQuery,
  ApiError,
} from './apiHelpers';

describe('parseApiError', () => {
  test('validation errors list every field message and map them by path', () => {
    const error = parseApiError(400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request is invalid',
        details: [
          {
            location: 'body',
            path: 'password',
            message: 'Password must be at least 10 characters',
          },
          { location: 'body', path: 'email', message: 'Invalid email' },
        ],
      },
    });
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Password must be at least 10 characters\nInvalid email');
    expect(error.field_errors).toEqual({
      password: 'Password must be at least 10 characters',
      email: 'Invalid email',
    });
  });

  test('known codes get a friendly message', () => {
    const error = parseApiError(401, {
      error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' },
    });
    expect(error.code).toBe('INVALID_CREDENTIALS');
    expect(error.message).toBe('Invalid email or password.');
    expect(parseApiError(409, { error: { code: 'EMAIL_TAKEN', message: 'x' } }).message).toMatch(
      /already exists/,
    );
  });

  test('unknown codes fall back to the server message', () => {
    const error = parseApiError(400, { error: { code: 'SOMETHING_NEW', message: 'New thing' } });
    expect(error.code).toBe('SOMETHING_NEW');
    expect(error.message).toBe('New thing');
    expect(error.field_errors).toEqual({});
  });

  test('a body that is missing or the wrong shape still gives a readable error', () => {
    expect(parseApiError(502, null).code).toBe('SERVER_ERROR');
    expect(parseApiError(502, null).message).toMatch(/server/);
    expect(parseApiError(418, { nope: true }).message).toBe('Something went wrong (error 418).');
    expect(parseApiError(503, { status: 'degraded' }).code).toBe('SERVER_ERROR');
  });

  test('validation with no details still has a message', () => {
    const error = parseApiError(400, { error: { code: 'VALIDATION_ERROR', message: 'Bad' } });
    expect(error.message).toBe('Bad');
  });

  test('networkError has status 0 and its own code', () => {
    expect(networkError().status).toBe(0);
    expect(networkError().code).toBe('NETWORK_ERROR');
  });
});

describe('createSingleFlight', () => {
  test('callers that overlap share one call', async () => {
    let calls = 0;
    let finish;
    const shared = createSingleFlight(() => {
      calls++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const first = shared();
    const second = shared();
    const third = shared();
    await Promise.resolve();
    finish('done');
    await expect(Promise.all([first, second, third])).resolves.toEqual(['done', 'done', 'done']);
    expect(calls).toBe(1);
  });

  test('a new call starts once the last one settles, even after a failure', async () => {
    let calls = 0;
    const shared = createSingleFlight(async () => {
      calls++;
      if (calls === 1) {
        throw new Error('first fails');
      }
      return calls;
    });
    await expect(shared()).rejects.toThrow('first fails');
    await expect(shared()).resolves.toBe(2);
    expect(calls).toBe(2);
  });
});

describe('buildQuery', () => {
  test('skips empty values and encodes the rest', () => {
    expect(buildQuery({ limit: 30, cursor: null })).toBe('?limit=30');
    expect(buildQuery({ key: 'attachments/a b.jpg' })).toBe('?key=attachments%2Fa%20b.jpg');
    expect(buildQuery({})).toBe('');
    expect(buildQuery(undefined)).toBe('');
  });
});
