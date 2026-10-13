import { useState } from 'react';
import { Text, Pressable, StyleSheet, View } from 'react-native';
import AuthLayout from '../components/AuthLayout';
import SubmitButton from '../components/SubmitButton';
import TextField from '../../../components/TextField';
import { useAuth, homeRouteFor } from '../context/AuthContext';
import { checkEmail, checkLoginPassword, collectErrors } from '../utils/authValidation';
import { COLORS, SPACING, FONTS } from '../../../theme';

function LoginScreen(props) {
  const { login, session_expired } = useAuth();
  // expired is set when the app sent someone here because their session ran out
  // it comes from the auth context now, so only ids ever travel as route params
  const expired = session_expired;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [field_errors, setFieldErrors] = useState({});
  const [server_error, setServerError] = useState(
    expired ? 'Your session ended. Please log in again.' : '',
  );
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    const errors = collectErrors({
      email: checkEmail(email),
      password: checkLoginPassword(password),
    });
    setFieldErrors(errors);
    setServerError('');
    if (Object.keys(errors).length > 0) {
      return;
    }
    setBusy(true);
    try {
      const user = await login(email, password);
      // reset so back can't return to the login form
      props.navigation.reset({ index: 0, routes: [{ name: homeRouteFor(user) }] });
    } catch (error) {
      setFieldErrors(error.field_errors || {});
      setServerError(error.message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Log In"
      error={server_error}
      footer={
        <View style={styles.links}>
          <Pressable onPress={() => props.navigation.navigate('RegisterOwner')} hitSlop={8}>
            <Text style={styles.link}>New landlord? Create an account</Text>
          </Pressable>
          <Pressable onPress={() => props.navigation.navigate('RegisterTenant')} hitSlop={8}>
            <Text style={styles.link}>I have an invite code</Text>
          </Pressable>
        </View>
      }
    >
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
        placeholder="Password"
        secureTextEntry
        textContentType="password"
        autoComplete="password"
        onSubmitEditing={handleLogin}
      />
      <SubmitButton title="Log In" busy_title="Logging in..." busy={busy} onPress={handleLogin} />
    </AuthLayout>
  );
}

export default LoginScreen;

const styles = StyleSheet.create({
  links: {
    alignItems: 'center',
    gap: SPACING.md,
  },
  link: {
    color: COLORS.action,
    fontFamily: FONTS.body_bold,
    fontSize: 15,
  },
});
