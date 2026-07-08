import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Linking
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme, getThemeOverrides } from '../context/ThemeContext';
import { apiCall, BASE_URL } from '../services/api';
import ThemeToggle from '../components/ThemeToggle';

interface UserItem {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  rol_id: number;
  rol_nombre: string;
}

interface GlobalOrder {
  pedido_id: number;
  cliente_nombre: string;
  alistador_nombre: string | null;
  total: string | number;
  estado: string;
  fecha_creacion: string;
}

interface WebDeleteButtonProps {
  onPress: () => void;
  label: string;
  disabled?: boolean;
  style: any;
}

function WebDeleteButton({ onPress, label, disabled, style }: WebDeleteButtonProps) {
  return (
    <button
      disabled={disabled}
      style={style}
      onClick={(e) => {
        if (!disabled) {
          e.stopPropagation();
          e.preventDefault();
          onPress();
        }
      }}
    >
      {label}
    </button>
  );
}

export default function AdminScreen() {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const themeStyles = getThemeOverrides(colors);
  const [activeTab, setActiveTab] = useState<'usuarios' | 'pedidos'>('usuarios');
  const [activeOrderSubTab, setActiveOrderSubTab] = useState<'pendientes' | 'despachados'>('pendientes');

  // State lists
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [ordersList, setOrdersList] = useState<GlobalOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // New User Form States
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRolId, setNewRolId] = useState<number>(2); // Default to Alistador (Rol 2)
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // Messages
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [usersRes, ordersRes] = await Promise.all([
        apiCall<UserItem[]>(`/admin/usuarios?requester_id=${user.id}`, 'GET'),
        apiCall<GlobalOrder[]>(`/admin/pedidos-global?requester_id=${user.id}`, 'GET')
      ]);

      if (usersRes.success && usersRes.data) {
        setUsersList(usersRes.data);
      }
      if (ordersRes.success && ordersRes.data) {
        setOrdersList(ordersRes.data);
      }
    } catch (e: any) {
      console.error('Error al cargar datos de administración:', e.message);
      setErrorMsg('No se pudieron recuperar los datos del servidor');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleCreateUser = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validation
    if (!newName.trim() || !newEmail.trim() || !newPassword || !newPhone.trim()) {
      setErrorMsg('Todos los campos son requeridos');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(newEmail)) {
      setErrorMsg('Ingrese un correo electrónico válido');
      return;
    }

    setIsSubmittingUser(true);
    try {
      const response = await apiCall<any>('/admin/crear-usuario', 'POST', {
        requester_id: user?.id,
        nombre: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        telefono: newPhone.trim(),
        rol_id: newRolId
      });

      if (response.success) {
        setSuccessMsg(`Usuario "${newName}" creado con éxito`);
        setNewName('');
        setNewEmail('');
        setNewPassword('');
        setNewPhone('');
        setNewRolId(2);
        await fetchData();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(response.message || 'Error al crear usuario');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  // Función de borrado directo (la confirmación se maneja en la UI mediante doble clic)
  const handleDeleteUser = useCallback(async (targetId: number, targetName: string) => {
    console.log("handleDeleteUser invocado para ID:", targetId, "Nombre:", targetName);
    setErrorMsg(null);
    setSuccessMsg(null);
    setConfirmDeleteId(null); // Resetear estado de confirmación

    console.log("Procediendo a realizar optimismo visual (filtrar de la lista)...");
    // OPTIMISMO VISUAL: Removemos al usuario del estado antes de golpear el backend
    setUsersList((prev) => prev.filter((u) => u.id !== targetId));

    try {
      console.log(`Enviando petición DELETE a /admin/usuarios/${targetId} con requester_id ${user?.id}...`);
      // Ajustá esta ruta si tu backend expone el endpoint bajo otra estructura (ej. /auth/usuarios)
      const response = await apiCall<any>(`/admin/usuarios/${targetId}?requester_id=${user?.id}`, 'DELETE');
      console.log("Respuesta del servidor recibida:", response);

      if (response.success) {
        console.log("Eliminación exitosa en servidor.");
        setSuccessMsg(`Usuario "${targetName}" eliminado con éxito`);
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        console.error("El servidor respondió con success: false", response.message);
        // Si falla en backend, traemos la lista de nuevo para restaurar al usuario
        fetchData();
        setErrorMsg(response.message || 'Error al eliminar el usuario en el servidor');
      }
    } catch (err: any) {
      console.error("Petición DELETE fallida:", err.message);
      // Restauramos la lista original si hay error de red
      fetchData();
      setErrorMsg('Error al conectar con el servidor. Se restauró la lista.');
    }
  }, [user, fetchData]);

  const getRoleLabel = (rolId: number) => {
    switch (rolId) {
      case 1: return 'Cliente';
      case 2: return 'Alistador';
      case 3: return 'Montacargas';
      case 4: return 'Inventario';
      case 5: return 'Admin';
      default: return 'Desconocido';
    }
  };

  const getRoleBadgeColor = (rolId: number) => {
    switch (rolId) {
      case 5: return '#FF3366';
      case 2: return '#3A86C8';
      case 3: return '#2A9D8F';
      case 4: return '#E76F51';
      case 1: return '#8338EC';
      default: return '#5C6B73';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Pendiente': return '#FF9F1C';
      case 'Alistando': return '#3A86C8';
      case 'Listo para Despacho':
      case 'Listo': return '#8338EC';
      case 'Entregado': return '#2A9D8F';
      default: return '#5C6B73';
    }
  };

  const formatCurrency = (amount: string | number) => {
    const val = parseFloat(amount.toString());
    return isNaN(val) ? '₡0.00' : `₡${val.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
  };

  const handleExportPDF = (pedidoId: number) => {
    const pdfUrl = `${BASE_URL}/pedidos/${pedidoId}/exportar-pdf`;
    Linking.openURL(pdfUrl).catch((err) => {
      console.error('Error opening PDF URL:', err);
      Alert.alert('Error', 'No se pudo abrir el enlace para descargar el PDF');
    });
  };

  if (isLoading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, themeStyles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, themeStyles.container]}>
      <StatusBar barStyle={colors.background === '#0B132B' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Header Banner */}
      <View style={[styles.header, themeStyles.header]}>
        <View style={styles.headerProfile}>
          <Text style={[styles.headerTitle, themeStyles.headerTitle]}>Panel de Control</Text>
          <Text style={[styles.headerUser, { color: colors.textSecondary }]}>Administrador: {user?.nombre}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ThemeToggle />
          <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.7}>
            <Text style={styles.logoutButtonText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'usuarios' && styles.tabButtonActive]}
          onPress={() => {
            setActiveTab('usuarios');
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'usuarios' && styles.tabTextActive]}>
            Usuarios ({usersList.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'pedidos' && styles.tabButtonActive]}
          onPress={() => {
            setActiveTab('pedidos');
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'pedidos' && styles.tabTextActive]}>
            Historial de Pedidos ({ordersList.length})
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3A86C8" />
          }
        >
          {errorMsg && (
            <View style={styles.errorAlert}>
              <Text style={styles.alertText}>{errorMsg}</Text>
            </View>
          )}
          {successMsg && (
            <View style={styles.successAlert}>
              <Text style={styles.alertText}>{successMsg}</Text>
            </View>
          )}

          {activeTab === 'usuarios' ? (
            <View>
              {/* Form Card */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Crear Nuevo Colaborador</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Nombre Completo</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nombre del empleado"
                    placeholderTextColor="#5C6B73"
                    value={newName}
                    onChangeText={setNewName}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Correo Electrónico</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="correo@empresa.com"
                    placeholderTextColor="#5C6B73"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={newEmail}
                    onChangeText={setNewEmail}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Contraseña Temporal</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Contraseña inicial"
                    placeholderTextColor="#5C6B73"
                    secureTextEntry
                    autoCapitalize="none"
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Teléfono de Contacto</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="####-####"
                    placeholderTextColor="#5C6B73"
                    keyboardType="phone-pad"
                    value={newPhone}
                    onChangeText={setNewPhone}
                  />
                </View>

                {/* Custom Role Selector */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Rol en la Empresa</Text>
                  <View style={styles.roleBtnRow}>
                    {[2, 3, 4, 1].map((rId) => (
                      <TouchableOpacity
                        key={rId}
                        style={[
                          styles.roleSelectBtn,
                          newRolId === rId && styles.roleSelectBtnActive
                        ]}
                        onPress={() => setNewRolId(rId)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.roleSelectBtnText,
                            newRolId === rId && styles.roleSelectBtnTextActive
                          ]}
                        >
                          {getRoleLabel(rId)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitButton, isSubmittingUser && styles.submitButtonDisabled]}
                  onPress={handleCreateUser}
                  disabled={isSubmittingUser}
                  activeOpacity={0.8}
                >
                  {isSubmittingUser ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.submitButtonText}>Registrar Usuario</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Users Table Card */}
              <View style={[styles.card, { marginTop: 20 }]}>
                <Text style={styles.cardTitle}>Listado de Usuarios Registrados</Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                  <View style={styles.table}>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderCell, { width: 140 }]}>Nombre</Text>
                      <Text style={[styles.tableHeaderCell, { width: 160 }]}>Email</Text>
                      <Text style={[styles.tableHeaderCell, { width: 100 }]}>Teléfono</Text>
                      <Text style={[styles.tableHeaderCell, { width: 100 }]}>Rol</Text>
                      <Text style={[styles.tableHeaderCell, { width: 100 }]}>Acciones</Text>
                    </View>

                    {usersList.length === 0 ? (
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No hay usuarios registrados</Text>
                      </View>
                    ) : (
                      usersList.map((usr) => (
                        <View key={usr.id} style={styles.tableRow}>
                          <Text style={[styles.tableCell, { width: 140, fontWeight: 'bold' }]} numberOfLines={1}>
                            {usr.nombre}
                          </Text>
                          <Text style={[styles.tableCell, { width: 160 }]} numberOfLines={1}>
                            {usr.email}
                          </Text>
                          <Text style={[styles.tableCell, { width: 100 }]}>
                            {usr.telefono}
                          </Text>
                          <View style={[{ width: 100, justifyContent: 'center' }]}>
                            <View style={[
                              styles.miniBadge,
                              { backgroundColor: getRoleBadgeColor(usr.rol_id) }
                            ]}>
                              <Text style={styles.miniBadgeText}>{usr.rol_nombre || getRoleLabel(usr.rol_id)}</Text>
                            </View>
                          </View>
                          <View style={[{ width: 100, justifyContent: 'center' }]}>
                            {usr.id !== user?.id ? (
                              confirmDeleteId === usr.id ? (
                                <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                                  {Platform.OS === 'web' ? (
                                    <>
                                      <WebDeleteButton
                                        onPress={() => handleDeleteUser(usr.id, usr.nombre)}
                                        label="Sí"
                                        style={{
                                          backgroundColor: '#FF3366',
                                          borderColor: '#FF3366',
                                          borderWidth: '1px',
                                          borderStyle: 'solid',
                                          paddingLeft: '8px',
                                          paddingRight: '8px',
                                          paddingTop: '4px',
                                          paddingBottom: '4px',
                                          borderRadius: '6px',
                                          color: '#FFFFFF',
                                          fontWeight: 'bold',
                                          fontSize: '11px',
                                          cursor: 'pointer',
                                          outline: 'none',
                                        }}
                                      />
                                      <WebDeleteButton
                                        onPress={() => setConfirmDeleteId(null)}
                                        label="No"
                                        style={{
                                          backgroundColor: '#1C2541',
                                          borderColor: '#5C6B7350',
                                          borderWidth: '1px',
                                          borderStyle: 'solid',
                                          paddingLeft: '8px',
                                          paddingRight: '8px',
                                          paddingTop: '4px',
                                          paddingBottom: '4px',
                                          borderRadius: '6px',
                                          color: '#5C6B73',
                                          fontWeight: 'bold',
                                          fontSize: '11px',
                                          cursor: 'pointer',
                                          outline: 'none',
                                        }}
                                      />
                                    </>
                                  ) : (
                                    <>
                                      <TouchableOpacity
                                        style={[styles.deleteButton, { backgroundColor: '#FF3366', paddingHorizontal: 8 }]}
                                        onPress={() => handleDeleteUser(usr.id, usr.nombre)}
                                        activeOpacity={0.7}
                                      >
                                        <Text style={styles.deleteButtonText}>Sí</Text>
                                      </TouchableOpacity>
                                      <TouchableOpacity
                                        style={[styles.deleteButton, { backgroundColor: '#1C2541', paddingHorizontal: 8 }]}
                                        onPress={() => setConfirmDeleteId(null)}
                                        activeOpacity={0.7}
                                      >
                                        <Text style={[styles.deleteButtonText, { color: '#5C6B73' }]}>No</Text>
                                      </TouchableOpacity>
                                    </>
                                  )}
                                </View>
                              ) : (
                                Platform.OS === 'web' ? (
                                  <WebDeleteButton
                                    onPress={() => setConfirmDeleteId(usr.id)}
                                    label="Eliminar"
                                    style={{
                                      backgroundColor: '#FF336620',
                                      borderColor: '#FF336680',
                                      borderWidth: '1px',
                                      borderStyle: 'solid',
                                      paddingLeft: '10px',
                                      paddingRight: '10px',
                                      paddingTop: '5px',
                                      paddingBottom: '5px',
                                      borderRadius: '6px',
                                      color: '#FF3366',
                                      fontWeight: 'bold',
                                      fontSize: '11px',
                                      cursor: 'pointer',
                                      outline: 'none',
                                    }}
                                  />
                                ) : (
                                  <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={() => setConfirmDeleteId(usr.id)}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={styles.deleteButtonText}>Eliminar</Text>
                                  </TouchableOpacity>
                                )
                              )
                            ) : (
                              Platform.OS === 'web' ? (
                                <WebDeleteButton
                                  disabled
                                  label="Eliminar"
                                  onPress={() => { }}
                                  style={{
                                    backgroundColor: '#1C2541',
                                    borderColor: '#5C6B7350',
                                    borderWidth: '1px',
                                    borderStyle: 'solid',
                                    paddingLeft: '10px',
                                    paddingRight: '10px',
                                    paddingTop: '5px',
                                    paddingBottom: '5px',
                                    borderRadius: '6px',
                                    color: '#5C6B73',
                                    fontWeight: 'bold',
                                    fontSize: '11px',
                                    cursor: 'default',
                                    outline: 'none',
                                  }}
                                />
                              ) : (
                                <View style={[styles.deleteButton, styles.deleteButtonDisabled]}>
                                  <Text style={[styles.deleteButtonText, { color: '#5C6B73' }]}>Eliminar</Text>
                                </View>
                              )
                            )}
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                </ScrollView>
              </View>
            </View>
          ) : (
            /* Orders Master History View */
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Registro Global de Órdenes</Text>

              <View style={styles.subTabContainer}>
                <TouchableOpacity
                  style={[
                    styles.subTabButton,
                    activeOrderSubTab === 'pendientes' && styles.subTabButtonActive
                  ]}
                  onPress={() => setActiveOrderSubTab('pendientes')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.subTabText,
                      activeOrderSubTab === 'pendientes' && styles.subTabTextActive
                    ]}
                  >
                    Pedidos Pendientes ({ordersList.filter(o => o.estado === 'Pendiente' || o.estado === 'Alistando').length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.subTabButton,
                    activeOrderSubTab === 'despachados' && styles.subTabButtonActive
                  ]}
                  onPress={() => setActiveOrderSubTab('despachados')}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.subTabText,
                      activeOrderSubTab === 'despachados' && styles.subTabTextActive
                    ]}
                  >
                    Pedidos Despachados ({ordersList.filter(o => o.estado === 'Listo para Despacho' || o.estado === 'Listo' || o.estado === 'Entregado').length})
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderCell, { width: 70 }]}>ID Pedido</Text>
                    <Text style={[styles.tableHeaderCell, { width: 130 }]}>Cliente</Text>
                    <Text style={[styles.tableHeaderCell, { width: 130 }]}>Alistador Asignado</Text>
                    <Text style={[styles.tableHeaderCell, { width: 110 }]}>Total (con IVA)</Text>
                    <Text style={[styles.tableHeaderCell, { width: 130 }]}>Estado</Text>
                    <Text style={[styles.tableHeaderCell, { width: 100 }]}>Acciones</Text>
                  </View>

                  {ordersList.filter(ord => {
                    const isPending = ord.estado === 'Pendiente' || ord.estado === 'Alistando';
                    return activeOrderSubTab === 'pendientes' ? isPending : !isPending;
                  }).length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>
                        No hay pedidos {activeOrderSubTab === 'pendientes' ? 'pendientes o en alisto' : 'despachados'} registrados
                      </Text>
                    </View>
                  ) : (
                    ordersList
                      .filter(ord => {
                        const isPending = ord.estado === 'Pendiente' || ord.estado === 'Alistando';
                        return activeOrderSubTab === 'pendientes' ? isPending : !isPending;
                      })
                      .map((ord) => (
                        <View key={ord.pedido_id} style={styles.tableRow}>
                          <Text style={[styles.tableCell, { width: 70, color: '#3A86C8', fontWeight: 'bold' }]}>
                            #{ord.pedido_id}
                          </Text>
                          <Text style={[styles.tableCell, { width: 130 }]} numberOfLines={1}>
                            {ord.cliente_nombre}
                          </Text>
                          <Text style={[styles.tableCell, { width: 130, fontStyle: ord.alistador_nombre ? 'normal' : 'italic', color: ord.alistador_nombre ? '#FFFFFF' : '#5C6B73' }]} numberOfLines={1}>
                            {ord.alistador_nombre || 'Sin alistador'}
                          </Text>
                          <Text style={[styles.tableCell, { width: 110, fontWeight: 'bold', color: '#2A9D8F' }]}>
                            {formatCurrency(ord.total)}
                          </Text>
                          <View style={[{ width: 130, justifyContent: 'center' }]}>
                            <View style={[styles.statusBadge, { backgroundColor: getStatusBadgeColor(ord.estado) }]}>
                              <Text style={styles.statusBadgeText}>{ord.estado}</Text>
                            </View>
                          </View>
                          <View style={[{ width: 100, justifyContent: 'center', alignItems: 'center' }]}>
                            {ord.estado === 'Entregado' || ord.estado === 'Listo' || ord.estado === 'Listo para Despacho' ? (
                              <TouchableOpacity 
                                style={styles.pdfButton} 
                                onPress={() => handleExportPDF(ord.pedido_id)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.pdfButtonText}>📄 PDF</Text>
                              </TouchableOpacity>
                            ) : (
                              <Text style={{ color: '#5C6B73', fontSize: 12 }}>-</Text>
                            )}
                          </View>
                        </View>
                      ))
                  )}
                </View>
              </ScrollView>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B132B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1C2541',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#22333B',
  },
  headerProfile: {
    flexDirection: 'column',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerUser: {
    fontSize: 13,
    color: '#3A86C8',
    marginTop: 2,
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#FF336620',
    borderColor: '#FF336680',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#FF3366',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1C2541',
    borderBottomWidth: 1,
    borderBottomColor: '#22333B',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#3A86C8',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5C6B73',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  scrollContainer: {
    padding: 16,
    flexGrow: 1,
  },
  errorAlert: {
    backgroundColor: '#FF336620',
    borderColor: '#FF336650',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  successAlert: {
    backgroundColor: '#2A9D8F20',
    borderColor: '#2A9D8F50',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  alertText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#1C2541',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#22333B',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A86C8',
    marginBottom: 8,
  },
  input: {
    height: 48,
    backgroundColor: '#0B132B',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#22333B',
  },
  roleBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleSelectBtn: {
    flex: 1,
    height: 42,
    backgroundColor: '#0B132B',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22333B',
  },
  roleSelectBtnActive: {
    backgroundColor: '#3A86C820',
    borderColor: '#3A86C8',
  },
  roleSelectBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5C6B73',
  },
  roleSelectBtnTextActive: {
    color: '#3A86C8',
    fontWeight: 'bold',
  },
  submitButton: {
    height: 48,
    backgroundColor: '#3A86C8',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#3A86C8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: '#5C6B73',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  table: {
    flexDirection: 'column',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0B132B',
    paddingVertical: 10,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#22333B',
  },
  tableHeaderCell: {
    color: '#3A86C8',
    fontWeight: 'bold',
    fontSize: 13,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#22333B',
    alignItems: 'center',
  },
  tableCell: {
    color: '#FFFFFF',
    fontSize: 13,
    paddingHorizontal: 8,
  },
  emptyContainer: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#5C6B73',
    fontSize: 14,
    fontStyle: 'italic',
  },
  miniBadge: {
    backgroundColor: '#3A86C8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  miniBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: '#FF336620',
    borderColor: '#FF336680',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  deleteButtonDisabled: {
    backgroundColor: '#1C2541',
    borderColor: '#5C6B7350',
  },
  deleteButtonText: {
    color: '#FF3366',
    fontWeight: 'bold',
    fontSize: 11,
  },
  subTabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: '#0B132B',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: '#22333B',
  },
  subTabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  subTabButtonActive: {
    backgroundColor: '#3A86C8',
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5C6B73',
    textAlign: 'center',
  },
  subTabTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  pdfButton: {
    backgroundColor: '#3A86C815',
    borderColor: '#3A86C850',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfButtonText: {
    color: '#3A86C8',
    fontSize: 11,
    fontWeight: 'bold',
  },
});