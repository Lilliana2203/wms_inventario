import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

interface LoginScreenProps {
  onNavigateToRegister: () => void;
  onNavigateToRecovery: () => void;
  onNavigateToCatalog: () => void;
}

export default function LoginScreen({ 
  onNavigateToRegister, 
  onNavigateToRecovery, 
  onNavigateToCatalog 
}: LoginScreenProps) {
  const { login, error, clearError } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLocalError(null);
    clearError();

    // Client-side validations
    if (!email.trim()) {
      setLocalError('El correo electrónico es requerido');
      return;
    }
    if (!password) {
      setLocalError('La contraseña es requerida');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setLocalError('Ingresa un correo electrónico válido');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (e: any) {
      console.log('Login failed:', e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeError = localError || error;
  const styles = getStyles(colors);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      
      {/* Top Floating Theme Switch */}
      <View style={styles.topBar}>
        <ThemeToggle />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        
        {/* Header Section */}
        <View style={styles.headerContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>WMS</Text>
          </View>
          <Text style={styles.title}>Sistema de Inventario</Text>
          <Text style={styles.subtitle}>Inicie sesión para continuar</Text>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          
          {/* Error Message Box */}
          {activeError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{activeError}</Text>
            </View>
          )}

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Correo Electrónico</Text>
            <TextInput
              style={styles.input}
              placeholder="ejemplo@correo.com"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (localError) setLocalError(null);
                clearError();
              }}
              editable={!isSubmitting}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Tu contraseña"
                placeholderTextColor={colors.textSecondary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (localError) setLocalError(null);
                  clearError();
                }}
                editable={!isSubmitting}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                activeOpacity={0.6}
              >
                <Text style={styles.eyeButtonText}>
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Recovery Link */}
          <TouchableOpacity 
            onPress={onNavigateToRecovery} 
            style={styles.recoveryBtn}
            disabled={isSubmitting}
          >
            <Text style={styles.recoveryLink}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.buttonText}>Ingresar</Text>
            )}
          </TouchableOpacity>

          {/* Navigation to Register */}
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>¿No tienes cuenta?</Text>
            <TouchableOpacity onPress={onNavigateToRegister} disabled={isSubmitting}>
              <Text style={styles.footerLink}>Regístrate aquí</Text>
            </TouchableOpacity>
          </View>

          {/* Navigation to Public Catalog */}
          <View style={[styles.footerRow, { marginTop: 16 }]}>
            <TouchableOpacity onPress={onNavigateToCatalog} disabled={isSubmitting}>
              <Text style={[styles.footerLink, { color: colors.warning }]}>
                ← Ver Catálogo Público
              </Text>
            </TouchableOpacity>
          </View>

        </View>

        {/* Footer info */}
        <Text style={styles.copyrightText}>
          WMS Inventarios v1.0.0 © 2026
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  logoBadgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 22,
    letterSpacing: 1.5,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorContainer: {
    backgroundColor: colors.danger + '20',
    borderColor: colors.danger + '50',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 8,
  },
  input: {
    height: 52,
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.inputText,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  passwordInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.inputText,
  },
  eyeButton: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    height: '100%',
  },
  eyeButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  recoveryBtn: {
    alignSelf: 'flex-end',
    marginTop: -10,
    marginBottom: 15,
  },
  recoveryLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: colors.textSecondary,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 6,
  },
  footerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  copyrightText: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 36,
  },
});
