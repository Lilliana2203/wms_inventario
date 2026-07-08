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
import { apiCall } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

interface RecuperarContrasenaScreenProps {
  onNavigateToLogin: () => void;
}

type StepType = 'request_email' | 'reset_password';

export default function RecuperarContrasenaScreen({ onNavigateToLogin }: RecuperarContrasenaScreenProps) {
  const { colors } = useTheme();
  
  // Shared States
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<StepType>('request_email');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Email step states
  const [tokenSimulado, setTokenSimulado] = useState<string | null>(null);

  // Reset step states
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step 1: Request Recovery Token
  const handleRecover = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setTokenSimulado(null);

    if (!email.trim()) {
      setErrorMsg('El correo electrónico es requerido');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setErrorMsg('Ingresa un correo electrónico válido');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiCall<{ tokenSimulado: string }>('/auth/recuperar', 'POST', {
        email: email.trim().toLowerCase()
      });

      if (response.success) {
        setSuccessMsg(response.message || 'Código de restauración enviado con éxito');
        if (response.data && response.data.tokenSimulado) {
          setTokenSimulado(response.data.tokenSimulado);
        }
        // Transition to next step
        setTimeout(() => {
          setStep('reset_password');
          setErrorMsg(null);
          setSuccessMsg(null);
        }, 1500);
      } else {
        setErrorMsg(response.message || 'Error al solicitar token de restauración');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión con el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Validate Token & Reset Password
  const handleResetPassword = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!token.trim()) {
      setErrorMsg('El token de validación es requerido');
      return;
    }
    if (!newPassword) {
      setErrorMsg('La nueva contraseña es requerida');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Las contraseñas ingresadas no coinciden');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiCall<any>('/auth/restablecer', 'POST', {
        email: email.trim().toLowerCase(),
        token: token.trim().toUpperCase(),
        newPassword
      });

      if (response.success) {
        setSuccessMsg('Contraseña actualizada con éxito. Redirigiendo al inicio de sesión...');
        setTimeout(() => {
          onNavigateToLogin();
        }, 2000);
      } else {
        setErrorMsg(response.message || 'Error al actualizar contraseña');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <Text style={styles.title}>Recuperar Contraseña</Text>
          <Text style={styles.subtitle}>
            {step === 'request_email' 
              ? 'Le enviaremos un token temporal de restauración por correo' 
              : 'Ingrese el token recibido y su nueva contraseña'}
          </Text>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          
          {errorMsg && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          )}

          {successMsg && (
            <View style={styles.successContainer}>
              <Text style={styles.successText}>{successMsg}</Text>
              {tokenSimulado && (
                <View style={styles.tokenBox}>
                  <Text style={styles.tokenLabel}>Token de Recuperación (Simulado):</Text>
                  <Text style={styles.tokenValue}>{tokenSimulado}</Text>
                </View>
              )}
            </View>
          )}

          {step === 'request_email' ? (
            /* STEP 1: REQUEST EMAIL VIEW */
            <View>
              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Correo Electrónico registrado</Text>
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
                    if (errorMsg) setErrorMsg(null);
                  }}
                  editable={!isSubmitting}
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.button, isSubmitting && styles.buttonDisabled]}
                onPress={handleRecover}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Enviar Token</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* STEP 2: RESET PASSWORD VIEW */
            <View>
              {/* Token Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Token de Validación (6 caracteres)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: A1B2C3"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="characters"
                  maxLength={6}
                  autoCorrect={false}
                  value={token}
                  onChangeText={(text) => {
                    setToken(text);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  editable={!isSubmitting}
                />
              </View>

              {/* New Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nueva Contraseña (mínimo 6 caracteres)</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Ingrese su nueva contraseña"
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={newPassword}
                    onChangeText={(text) => {
                      setNewPassword(text);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    editable={!isSubmitting}
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeButton}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.eyeButtonText}>
                      {showNewPassword ? 'Ocultar' : 'Mostrar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirmar Nueva Contraseña</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Confirme su nueva contraseña"
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    editable={!isSubmitting}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.eyeButtonText}>
                      {showConfirmPassword ? 'Ocultar' : 'Mostrar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Reset Password Button */}
              <TouchableOpacity
                style={[styles.button, isSubmitting && styles.buttonDisabled]}
                onPress={handleResetPassword}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Actualizar Contraseña</Text>
                )}
              </TouchableOpacity>

              {/* Go Back to Email Request */}
              <TouchableOpacity
                style={styles.backStepButton}
                onPress={() => {
                  setStep('request_email');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                disabled={isSubmitting}
              >
                <Text style={styles.backStepButtonText}>← Modificar correo electrónico</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Navigation Back to Login */}
          <View style={styles.footerRow}>
            <TouchableOpacity onPress={onNavigateToLogin} disabled={isSubmitting}>
              <Text style={styles.footerLink}>← Volver a Iniciar Sesión</Text>
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
    paddingHorizontal: 10,
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
  successContainer: {
    backgroundColor: colors.success + '20',
    borderColor: colors.success + '50',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  successText: {
    color: colors.success,
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
  tokenBox: {
    marginTop: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  tokenLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  tokenValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
    letterSpacing: 2,
  },
  backStepButton: {
    marginTop: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  backStepButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
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
