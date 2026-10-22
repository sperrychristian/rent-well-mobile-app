import { useState } from 'react';
import { Text, Pressable, View } from 'react-native';
import AuthLayout from '../components/AuthLayout';
import SubmitButton from '../components/SubmitButton';
import TextField from '../../../components/TextField';
import { useAuth, homeRouteFor } from '../context/AuthContext';
import {
  checkEmail,
  checkNewPassword,
  checkName,
  checkInviteCode,
  normalizeInviteCode,
  collectErrors,
} from '../utils/authValidation';
import { SPACING, TYPE, SIZES } from '../../../theme';
import { themedStyles } from '../../../utils/themedStyles';

function RegisterTenantScreen(props) {
  const { registerTenant } = useAuth();

  const [invite_code, setInviteCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [field_errors, setFieldErrors] = useState({});
  const [server_error, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleRegister() {
    const errors = collectErrors({
      invite_code: checkInviteCode(invite_code),
      name: checkName(name, false),
      email: checkEmail(email),
      password: checkNewPassword(password),
    });
    setFieldErrors(errors);
    setServerError('');
    if (Object.keys(errors).length > 0) {
      return;
    }
    setBusy(true);
    try {
      const user = await registerTenant({
        invite_code: normalizeInviteCode(invite_code),
        name: name.trim(),
        email: email.trim(),
        password: password,
      });
      props.navigation.reset({ index: 0, routes: [{ name: homeRouteFor(user) }] });
    } catch (error) {
      // the server calls the code field inviteCode, my form calls it invite_code
      const server_fields = error.field_errors || {};
      setFieldErrors({ ...server_fields, invite_code: server_fields.inviteCode });
      setServerError(error.message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Tenant Sign Up"
      subtitle="Join your rental with the code from your landlord."
      error={server_error}
      footer={
        <View style={styles.links}>
          <Pressable
            onPress={() => props.navigation.navigate('Login')}
            hitSlop={8}
            accessibilityRole="link"
            style={styles.link_press}
          >
            <Text style={styles.link}>Already have an account? Log in</Text>
          </Pressable>
        </View>
      }
    >
      <TextField
        label="Invite code"
        value={invite_code}
        onChangeText={setInviteCode}
        error={field_errors.invite_code}
        placeholder="K7M2-QX9P"
        autoCapitalize="characters"
        autoCorrect={false}
        // the hint lives in the field now, so it sits under the box and swaps out for an error
        helper="Your landlord sends this. Dashes and spaces are fine."
      />
      <TextField
        label="Your name (optional)"
        value={name}
        onChangeText={setName}
        error={field_errors.name}
        placeholder="Leave blank to use the name on the invite"
        textContentType="name"
        autoComplete="name"
      />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={field_errors.email}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="username"
        autoComplete="email"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={field_errors.password}
        placeholder="At least 10 characters"
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        onSubmitEditing={handleRegister}
      />
      <SubmitButton title="Join" busy_title="Joining..." busy={busy} onPress={handleRegister} />
    </AuthLayout>
  );
}

export default RegisterTenantScreen;

const styles = themedStyles((COLORS) => ({
  links: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  // each link is a full 44pt tall row so it's easy to tap
  link_press: {
    minHeight: SIZES.touch,
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  link: {
    ...TYPE.subheading,
    color: COLORS.cta,
    textAlign: 'center',
  },
}));
