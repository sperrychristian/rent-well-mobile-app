import { useState } from 'react';
import AuthContent from '../../../components/Auth/AuthContent';
import { useAuth } from '../../../store/AuthContext';
import { authErrorMessage } from '../../../util/auth';
import { describeAuthFailure } from '../utils/authErrors';

// assignment 12: the lecture's LoginScreen, isAuthenticating shows the "Logging in..." overlay while
// Firebase answers, and AuthContent below it is the form. login comes from AuthContext, which calls util/auth.js
function LoginScreen(props) {
  const { login, session_expired } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  // expired is set when the app sent someone here because their session ran out
  // it comes from the auth context now, so only ids ever travel as route params
  const [server_error, setServerError] = useState(
    session_expired ? authErrorMessage('TOKEN_EXPIRED') : '',
  );
  const [server_fields, setServerFields] = useState({});

  async function loginHandler(credentials) {
    setIsAuthenticating(true);
    setServerError('');
    setServerFields({});
    try {
      await login(credentials.email, credentials.password);
      // reset so back can't return to the login form
      // App.js does that reset itself now: once the user is set it starts a fresh navigator on their home
      // (homeRouteFor), and the signed-out stack doesn't even have the homes to reset to
    } catch (error) {
      const failure = describeAuthFailure(error);
      setServerError(failure.message);
      setServerFields(failure.field_errors);
      setIsAuthenticating(false);
    }
  }

  return (
    <AuthContent
      mode="login"
      subtitle="Log in with your email and password."
      submitTitle="Log In"
      loadingMessage="Logging in..."
      isAuthenticating={isAuthenticating}
      onAuthenticate={loginHandler}
      serverError={server_error}
      serverFieldErrors={server_fields}
      links={[
        { label: 'New landlord? Create an account', to: 'RegisterOwner' },
        { label: 'I have an invite code', to: 'RegisterTenant' },
      ]}
    />
  );
}

export default LoginScreen;
