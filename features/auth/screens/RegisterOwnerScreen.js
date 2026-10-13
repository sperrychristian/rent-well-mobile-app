import { useState } from 'react';
import { Text, Pressable, StyleSheet, View } from 'react-native';
import AuthLayout from '../components/AuthLayout';
import SubmitButton from '../components/SubmitButton';
import TextField from '../../../components/TextField';
import { useAuth, homeRouteFor } from '../context/AuthContext';
import { checkEmail, checkNewPassword, checkName, collectErrors } from '../utils/authValidation';
import { COLORS, SPACING, TYPE, SIZES } from '../../../theme';

function RegisterOwnerScreen(props) {
  const { registerOwner } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [field_errors, setFieldErrors] = useState({});
  const [server_error, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleRegister() {
    const errors = collectErrors({
      name: checkName(name, true),
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
      const user = await registerOwner({
        name: name.trim(),
        email: email.trim(),
        password: password,
      });
      props.navigation.reset({ index: 0, routes: [{ name: homeRouteFor(user) }] });
    } catch (error) {
      setFieldErrors(error.field_errors || {});
      setServerError(error.message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Landlord Sign Up"
      subtitle="Create a landlord account for your properties."
      error={server_error}
      footer={
        <View style={styles.links}>
          <Pressable
            onPress={() => props.navigation.navigate('RegisterTenant')}
            hitSlop={8}
            accessibilityRole="link"
            style={styles.link_press}
          >
            <Text style={styles.link}>Renting? Sign up with your invite code</Text>
          </Pressable>
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
        label="Your name"
        value={name}
        onChangeText={setName}
        error={field_errors.name}
        placeholder="Full name"
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
      <SubmitButton
        title="Create Account"
        busy_title="Creating account..."
        busy={busy}
        onPress={handleRegister}
      />
    </AuthLayout>
  );
}

export default RegisterOwnerScreen;

const styles = StyleSheet.create({
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
});
