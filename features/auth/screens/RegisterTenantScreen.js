import { useState } from 'react';
import AuthContent from '../../../components/Auth/AuthContent';
import { useAuth, homeRouteFor } from '../../../store/AuthContext';
import { normalizeInviteCode } from '../utils/authValidation';
import { describeAuthFailure } from '../utils/authErrors';

// assignment 12: the lecture's SignupScreen for tenants: the invite code from the landlord comes first
// (checked against the invites node after the Firebase account is made), then the name, email, and passwords
function RegisterTenantScreen(props) {
  const { registerTenant } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [server_error, setServerError] = useState('');
  const [server_fields, setServerFields] = useState({});

  async function signupHandler(credentials) {
    setIsAuthenticating(true);
    setServerError('');
    setServerFields({});
    try {
      const user = await registerTenant({
        invite_code: normalizeInviteCode(credentials.invite_code),
        name: credentials.name,
        email: credentials.email,
        password: credentials.password,
      });
      props.navigation.reset({ index: 0, routes: [{ name: homeRouteFor(user) }] });
    } catch (error) {
      const failure = describeAuthFailure(error);
      setServerError(failure.message);
      setServerFields(failure.field_errors);
      setIsAuthenticating(false);
    }
  }

  return (
    <AuthContent
      mode="tenant"
      subtitle="Join your rental with the code from your landlord."
      submitTitle="Join"
      loadingMessage="Creating user..."
      isAuthenticating={isAuthenticating}
      onAuthenticate={signupHandler}
      serverError={server_error}
      serverFieldErrors={server_fields}
      links={[{ label: 'Already have an account? Log in', to: 'Login' }]}
    />
  );
}

export default RegisterTenantScreen;
