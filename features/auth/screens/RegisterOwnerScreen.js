import { useState } from 'react';
import AuthContent from '../../../components/Auth/AuthContent';
import { useAuth } from '../../../store/AuthContext';
import { describeAuthFailure } from '../utils/authErrors';

// assignment 12: the lecture's SignupScreen for landlords: name, email twice, password twice,
// "Creating user..." while Firebase makes the account and the profile saves
function RegisterOwnerScreen(props) {
  const { registerOwner } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [server_error, setServerError] = useState('');
  const [server_fields, setServerFields] = useState({});

  async function signupHandler(credentials) {
    setIsAuthenticating(true);
    setServerError('');
    setServerFields({});
    try {
      await registerOwner({
        name: credentials.name,
        email: credentials.email,
        password: credentials.password,
      });
      // App.js starts a fresh navigator on the new account's home (homeRouteFor) as soon as it's signed in
    } catch (error) {
      const failure = describeAuthFailure(error);
      setServerError(failure.message);
      setServerFields(failure.field_errors);
      setIsAuthenticating(false);
    }
  }

  return (
    <AuthContent
      mode="owner"
      subtitle="Create a landlord account for your properties."
      submitTitle="Create Account"
      loadingMessage="Creating user..."
      isAuthenticating={isAuthenticating}
      onAuthenticate={signupHandler}
      serverError={server_error}
      serverFieldErrors={server_fields}
      links={[
        { label: 'Renting? Sign up with your invite code', to: 'RegisterTenant' },
        { label: 'Already have an account? Log in', to: 'Login' },
      ]}
    />
  );
}

export default RegisterOwnerScreen;
