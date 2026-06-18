import { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  TextInput, 
  Pressable, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring 
} from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { supabase } from '@/config/supabase';

export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [loadingLocations, setLoadingLocations] = useState(true);

  // Focus states
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);

  // Button animation
  const buttonScale = useSharedValue(1);

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.95, { damping: 10 });
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1.0, { damping: 10 });
  };

  const animatedButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  useEffect(() => {
    async function fetchLocations() {
      try {
        const { data, error } = await supabase
          .from('locations')
          .select('id, name')
          .order('name', { ascending: true });
        if (error) throw error;
        setLocations(data || []);
      } catch (err: any) {
        console.error('Error fetching locations:', err.message);
      } finally {
        setLoadingLocations(false);
      }
    }
    fetchLocations();
  }, []);

  const handleSignup = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!selectedLocationId) {
      Alert.alert('Error', 'Please select a location');
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, name, selectedLocationId);
    setLoading(false);

    if (error) {
      Alert.alert('Signup Failed', error.message || 'An error occurred during sign up');
    } else {
      Alert.alert(
        'Success', 
        'Account created successfully! Logging you in...',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)/home') }]
      );
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Ambient Neon glows */}
        <View style={styles.ambientGlowTop} />
        <View style={styles.ambientGlowBottom} />

        <View style={styles.header}>
          <Image
            source={require('@/assets/images/plugus-logo.jpg')}
            style={styles.logo}
            contentFit="contain"
          />
          <ThemedText style={styles.title}>Create Account</ThemedText>
          <ThemedText style={styles.subtitle}>Sign up to connect and power up with plugus</ThemedText>
        </View>

        {/* Glassmorphic Signup Form Card */}
        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Full Name</ThemedText>
            <TextInput
              style={[
                styles.input, 
                nameFocused && styles.inputActive
              ]}
              placeholder="e.g. Alex Carter"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              autoCapitalize="words"
              autoCorrect={false}
              value={name}
              onChangeText={setName}
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Email Address</ThemedText>
            <TextInput
              style={[
                styles.input, 
                emailFocused && styles.inputActive
              ]}
              placeholder="e.g. hello@plugus.co"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Password</ThemedText>
            <TextInput
              style={[
                styles.input, 
                passwordFocused && styles.inputActive
              ]}
              placeholder="••••••••••••"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Confirm Password</ThemedText>
            <TextInput
              style={[
                styles.input, 
                confirmPasswordFocused && styles.inputActive
              ]}
              placeholder="••••••••••••"
              placeholderTextColor="rgba(255, 255, 255, 0.3)"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onFocus={() => setConfirmPasswordFocused(true)}
              onBlur={() => setConfirmPasswordFocused(false)}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.inputLabel}>Select Location</ThemedText>
            {loadingLocations ? (
              <ActivityIndicator color="#00E5FF" size="small" style={{ marginVertical: Spacing.two }} />
            ) : locations.length === 0 ? (
              <ThemedText style={styles.errorText}>No locations available. Contact Super Admin.</ThemedText>
            ) : (
              <View style={styles.locationContainer}>
                {locations.map((loc) => {
                  const isSelected = selectedLocationId === loc.id;
                  return (
                    <Pressable
                      key={loc.id}
                      style={[
                        styles.locationTag,
                        isSelected && styles.locationTagActive
                      ]}
                      onPress={() => setSelectedLocationId(loc.id)}
                    >
                      <ThemedText style={[
                        styles.locationTagText,
                        isSelected && styles.locationTagTextActive
                      ]}>
                        📍 {loc.name}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Animated Sign Up Button */}
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={handleSignup}
            disabled={loading}
            style={styles.buttonWrapper}
          >
            <Animated.View style={[styles.button, animatedButtonStyle]}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <ThemedText style={styles.buttonText}>Sign Up</ThemedText>
              )}
            </Animated.View>
          </Pressable>
        </View>

        {/* Footer Navigation */}
        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>
            Already have an account?{' '}
            <ThemedText 
              style={styles.loginLink}
              onPress={() => router.push('/login')}
            >
              Log in
            </ThemedText>
          </ThemedText>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050608', // Match login background
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    paddingVertical: Spacing.six,
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -150,
    right: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: '#9C3FEF',
    opacity: 0.12,
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -150,
    left: -100,
    width: 350,
    height: 350,
    borderRadius: 175,
    backgroundColor: '#00E5FF',
    opacity: 0.08,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: Spacing.three,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#B0B4BA',
    textAlign: 'center',
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
    padding: Spacing.four,
    gap: Spacing.four,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 5,
  },
  inputGroup: {
    gap: Spacing.one,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: Spacing.three,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  inputActive: {
    borderColor: '#9C3FEF',
    backgroundColor: 'rgba(156, 63, 239, 0.04)',
    shadowColor: '#9C3FEF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  buttonWrapper: {
    marginTop: Spacing.two,
  },
  button: {
    backgroundColor: '#9C3FEF',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#9C3FEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 3,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.five,
  },
  footerText: {
    fontSize: 14,
    color: '#B0B4BA',
    fontWeight: '500',
  },
  loginLink: {
    color: '#00E5FF',
    fontWeight: '700',
  },
  locationContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  locationTag: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  locationTagActive: {
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
  },
  locationTagText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#B0B4BA',
  },
  locationTagTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  errorText: {
    fontSize: 13,
    color: '#FF3333',
    fontStyle: 'italic',
  },
});
