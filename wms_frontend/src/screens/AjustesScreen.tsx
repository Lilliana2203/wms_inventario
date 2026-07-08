import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Modal,
  RefreshControl
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme, getThemeOverrides } from '../context/ThemeContext';
import { apiCall } from '../services/api';
import ThemeToggle from '../components/ThemeToggle';

const ARTICLES = [
  { id: 1, nombre: 'Taladros' },
  { id: 2, nombre: 'Servicios Sanitarios' },
  { id: 3, nombre: 'Sierra' },
  { id: 4, nombre: 'Puertas' },
  { id: 5, nombre: 'Martillo de Impacto' },
  { id: 6, nombre: 'Caja de herramientas' },
  { id: 7, nombre: 'Ventiladores' },
  { id: 8, nombre: 'Caladoras' },
  { id: 9, nombre: 'Esmeril' },
  { id: 10, nombre: 'Ligadora Orbital' }
];

const ARTICLE_IDS: { [key: string]: number } = {
  'Taladros': 1,
  'Taladros DeWalt 20V Max': 1,
  'Servicios Sanitarios': 2,
  'Servicios Sanitarios American Standard': 2,
  'Sierra': 3,
  'Sierra Circular Makita 7-1/4': 3,
  'Puertas': 4,
  'Puertas de Madera KanForm': 4,
  'Martillo de Impacto': 5,
  'Martillo de Impacto Bosch Professional': 5,
  'Caja de herramientas': 6,
  'Caja de herramientas Stanley de 19 pulgadas': 6,
  'Ventiladores': 7,
  'Ventiladores Industriales Lasko 20': 7,
  'Caladoras': 8,
  'Caladoras Black+Decker de Velocidad Variable': 8,
  'Esmeril': 9,
  'Esmeril Angular Milwaukee de 4-1/2': 9,
  'Ligadora Orbital': 10,
  'Lijadora Orbital Truper de 5 pulgadas': 10
};

interface RackPosition {
  rack_nombre: string;
  piso: number;
  tipo_piso: 'Alisto' | 'Altura';
  articulo: string;
  cantidad_actual: number;
  capacidad_maxima: number;
}

interface SolicitudAbasto {
  id: number;
  articulo_id: number;
  articulo: string;
  solicitado_por: number;
  solicitado_por_nombre: string;
  estado: string;
  fecha_creacion: string;
}

interface SupplierCartItem {
  cart_id: string;
  articulo_id: number;
  nombre: string;
  cantidad: number;
}

interface Movimiento {
  id: number;
  articulo_id: number;
  usuario_id: number;
  tipo_movimiento: 'ENTRADA' | 'SALIDA' | 'REABASTECIMIENTO' | 'AJUSTE';
  cantidad: number;
  posicion_origen: string | null;
  posicion_destino: string | null;
  fecha: string;
  articulo_nombre: string;
  usuario_nombre: string;
}

export default function AjustesScreen() {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'racks' | 'abastecer' | 'movimientos'>('racks');

  // Rack Map & Alistador Requests States
  const [racks, setRacks] = useState<{ [key: string]: RackPosition[] }>({});
  const [solicitudes, setSolicitudes] = useState<SolicitudAbasto[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal / Transaction States for Map Adjustments
  const [selectedPos, setSelectedPos] = useState<RackPosition | null>(null);
  const [actionType, setActionType] = useState<'ADD' | 'SUB' | null>(null);
  const [transactionQty, setTransactionQty] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Supplier Inbound Form States
  const [selectedSupplierArticle, setSelectedSupplierArticle] = useState<typeof ARTICLES[0] | null>(null);
  const [supplierQty, setSupplierQty] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [supplierCart, setSupplierCart] = useState<SupplierCartItem[]>([]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const themeStyles = getThemeOverrides(colors);

  const fetchRacksAndRequests = useCallback(async () => {
    try {
      const [racksResponse, solicitudesResponse] = await Promise.all([
        apiCall<RackPosition[]>('/inventario/racks', 'GET'),
        apiCall<SolicitudAbasto[]>('/inventario/solicitudes-abasto', 'GET')
      ]);

      if (racksResponse.success && racksResponse.data) {
        const grouped: { [key: string]: RackPosition[] } = {};
        racksResponse.data.forEach((pos) => {
          if (!grouped[pos.rack_nombre]) {
            grouped[pos.rack_nombre] = [];
          }
          grouped[pos.rack_nombre].push(pos);
        });

        Object.keys(grouped).forEach((rackKey) => {
          grouped[rackKey].sort((a, b) => b.piso - a.piso);
        });

        setRacks(grouped);
      }

      if (solicitudesResponse.success && solicitudesResponse.data) {
        setSolicitudes(solicitudesResponse.data);
      }
    } catch (e: any) {
      console.error('Error loading racks map or solicitudes:', e.message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchMovimientos = useCallback(async () => {
    try {
      const response = await apiCall<Movimiento[]>('/inventario/movimientos', 'GET');
      if (response.success && response.data) {
        setMovimientos(response.data);
      }
    } catch (e: any) {
      console.error('Error fetching movements:', e.message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'movimientos') {
      setIsLoading(true);
      fetchMovimientos();
    } else {
      setIsLoading(true);
      fetchRacksAndRequests();
    }
  }, [activeTab, fetchMovimientos, fetchRacksAndRequests]);

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'movimientos') {
      fetchMovimientos();
    } else {
      fetchRacksAndRequests();
    }
  };

  const handleOpenAction = (pos: RackPosition, type: 'ADD' | 'SUB') => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setTransactionQty('');
    setSelectedPos(pos);
    setActionType(type);
    setIsModalOpen(true);
  };

  // Escalate Alistador request to Montacargas (inserts task in tasks)
  const handleEscalateToMontacargas = async (sol: SolicitudAbasto) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await apiCall<any>('/inventario/solicitar-reabastecimiento', 'POST', {
        usuario_id: user?.id,
        articulo_id: sol.articulo_id
      });

      if (response.success) {
        setSuccessMsg(response.message || `Solicitud escalada para ${sol.articulo}`);
        await fetchRacksAndRequests();
        await fetchMovimientos();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(response.message || 'Error al escalar la solicitud');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor');
    }
  };

  // Direct Rack Adjustments (ADD to floor, SUB damage)
  const handleTransaction = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedPos || !actionType) return;

    const qty = parseInt(transactionQty, 10);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg('Debe ingresar una cantidad mayor a cero');
      return;
    }

    const artId = ARTICLE_IDS[selectedPos.articulo];
    if (!artId) {
      setErrorMsg('Error de mapeo: artículo no identificado');
      return;
    }

    setIsSubmitting(true);
    try {
      let response;
      if (actionType === 'ADD') {
        response = await apiCall<any>('/inventario/incrementar-stock', 'POST', {
          usuario_id: user?.id,
          articulo_id: artId,
          piso: selectedPos.piso,
          amount: qty, // compatibility
          cantidad: qty
        });
      } else {
        response = await apiCall<any>('/inventario/ajuste-dano', 'POST', {
          usuario_id: user?.id,
          articulo_id: artId,
          piso: selectedPos.piso,
          cantidad: qty
        });
      }

      if (response.success) {
        setSuccessMsg(
          actionType === 'ADD'
            ? `Ajuste exitoso: Se añadieron ${qty} unidades de "${selectedPos.articulo}" al piso ${selectedPos.piso}.`
            : `Ajuste exitoso: Se restaron ${qty} unidades de "${selectedPos.articulo}" del piso ${selectedPos.piso} por merma/daño.`
        );
        await fetchRacksAndRequests();
        await fetchMovimientos();
        setTimeout(() => {
          setIsModalOpen(false);
          setSelectedPos(null);
          setActionType(null);
        }, 1500);
      } else {
        setErrorMsg(response.message || 'Error al aplicar el ajuste');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Supplier cart actions
  const handleAddToSupplierCart = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedSupplierArticle) {
      setErrorMsg('Debe seleccionar un artículo');
      return;
    }

    const qty = parseInt(supplierQty, 10);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg('Debe ingresar una cantidad mayor a cero');
      return;
    }

    setSupplierCart((prev) => {
      const idx = prev.findIndex((item) => item.articulo_id === selectedSupplierArticle.id);
      if (idx > -1) {
        const newCart = [...prev];
        newCart[idx].cantidad += qty;
        return newCart;
      } else {
        return [
          ...prev,
          {
            cart_id: Date.now().toString() + Math.random().toString(),
            articulo_id: selectedSupplierArticle.id,
            nombre: selectedSupplierArticle.nombre,
            cantidad: qty
          }
        ];
      }
    });

    setSelectedSupplierArticle(null);
    setSupplierQty('');
  };

  const handleRemoveFromSupplierCart = (cartId: string) => {
    setSupplierCart((prev) => prev.filter((item) => item.cart_id !== cartId));
  };

  const handleConfirmSupplierInbound = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (supplierCart.length === 0) {
      setErrorMsg('El carrito de abastecimiento está vacío');
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsPayload = supplierCart.map((item) => ({
        articulo_id: item.articulo_id,
        cantidad: item.cantidad
      }));

      const response = await apiCall<any>('/inventario/compra-abastecimiento', 'POST', {
        usuario_id: user?.id,
        items: itemsPayload
      });

      if (response.success) {
        setSuccessMsg(response.message || '¡Abastecimiento de bodega completado con éxito!');
        setSupplierCart([]);
        await fetchRacksAndRequests();
        await fetchMovimientos();
      } else {
        setErrorMsg(response.message || 'Error al confirmar abastecimiento');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión al servidor');
    } finally {
      setIsSubmitting(false);
    }
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

      {/* Header */}
      <View style={[styles.header, themeStyles.header]}>
        <Text style={[styles.headerTitle, themeStyles.headerTitle]}>Panel de Inventario</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ThemeToggle />
          <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.7}>
            <Text style={styles.logoutButtonText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Selector */}
      <View style={[styles.tabContainer, themeStyles.tabContainer]}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'racks' && styles.tabButtonActive]}
          onPress={() => {
            setActiveTab('racks');
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'racks' && styles.tabTextActive]}>
            Control de Racks
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'abastecer' && styles.tabButtonActive]}
          onPress={() => {
            setActiveTab('abastecer');
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'abastecer' && styles.tabTextActive]}>
            Abastecer Bodega
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'movimientos' && styles.tabButtonActive]}
          onPress={() => {
            setActiveTab('movimientos');
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'movimientos' && styles.tabTextActive]}>
            Historial
          </Text>
        </TouchableOpacity>
      </View>

      {/* Global Feedback States */}
      {successMsg && !isModalOpen && !isDropdownOpen && (
        <View style={styles.globalSuccessContainer}>
          <Text style={styles.globalSuccessText}>{successMsg}</Text>
        </View>
      )}
      {errorMsg && !isModalOpen && !isDropdownOpen && (
        <View style={styles.globalErrorContainer}>
          <Text style={styles.globalErrorText}>{errorMsg}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3A86C8" />
        }
      >
        {/* Profile Card */}
        <View style={[styles.profileCard, themeStyles.profileCard]}>
          <View style={styles.profileDetails}>
            <Text style={[styles.welcomeText, { color: colors.primary }]}>Encargado de Inventario</Text>
            <Text style={[styles.userName, themeStyles.userName]}>{user?.nombre}</Text>
            <Text style={[styles.userEmail, themeStyles.userEmail]}>{user?.email}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '40' }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>Inventario</Text>
          </View>
        </View>

        {activeTab === 'racks' && (
          /* Adjustments Map Tab */
          <View style={{ gap: 20 }}>
            {/* Alistador Requests Escalation Widget */}
            {solicitudes.length > 0 && (
              <View style={[styles.requestsContainer, themeStyles.requestsContainer]}>
                <Text style={[styles.requestsTitle, { color: colors.text }]}>🔔 Solicitudes de Alistadores</Text>
                <View style={styles.requestsList}>
                  {solicitudes.map((sol) => (
                    <View key={sol.id} style={[styles.requestCard, themeStyles.requestCard]}>
                      <View style={styles.requestInfo}>
                        <Text style={[styles.requestArtName, themeStyles.requestArtName]}>{sol.articulo}</Text>
                        <Text style={[styles.requestDetails, themeStyles.requestDetails]}>
                          Por: {sol.solicitado_por_nombre} | {new Date(sol.fecha_creacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.escalateBtn}
                        onPress={() => handleEscalateToMontacargas(sol)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.escalateBtnText}>Escalar a Montacargas</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <Text style={styles.sectionTitle}>Control y Ajustes de Racks</Text>

            {/* Rack Maps */}
            {Object.keys(racks).map((rackName) => (
              <View key={rackName} style={[styles.rackContainer, themeStyles.rackContainer]}>
                <View style={styles.rackHeader}>
                  <Text style={[styles.rackTitle, themeStyles.rackTitle]}>{rackName}</Text>
                </View>

                <View style={styles.floorList}>
                  {racks[rackName].map((pos) => {
                    const isAltura = pos.tipo_piso === 'Altura';
                    const pct = Math.min((pos.cantidad_actual / pos.capacidad_maxima) * 100, 100);
                    const isOverStock = pos.cantidad_actual > pos.capacidad_maxima;

                    return (
                      <View key={pos.piso} style={[styles.floorCard, themeStyles.floorCard]}>
                        <View style={styles.floorRow}>
                          <View style={styles.floorLeft}>
                            <View style={[styles.floorIndicator, isAltura ? styles.floorIndicatorAltura : styles.floorIndicatorAlisto]}>
                              <Text style={styles.floorIndicatorText}>Piso {pos.piso}</Text>
                            </View>
                            <Text style={[styles.floorTypeText, themeStyles.floorTypeText]}>{pos.tipo_piso}</Text>
                          </View>

                          <View style={styles.floorRight}>
                            <Text style={[styles.stockText, themeStyles.stockText]}>
                              {pos.cantidad_actual} / {pos.capacidad_maxima} uds
                            </Text>
                          </View>
                        </View>

                        <Text style={[styles.articleName, { color: colors.text }]}>{pos.articulo}</Text>

                        {/* Progress Bar */}
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressBar,
                              { width: `${pct}%` },
                              isOverStock
                                ? { backgroundColor: '#FF3366' }
                                : pct > 85
                                ? { backgroundColor: '#F5A623' }
                                : { backgroundColor: '#10B981' }
                            ]}
                          />
                        </View>

                        {/* Inventory adjustments */}
                        <View style={styles.actionRow}>
                          <TouchableOpacity
                            style={[styles.adjustBtn, styles.adjustBtnAdd]}
                            onPress={() => handleOpenAction(pos, 'ADD')}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.adjustBtnText}>
                              {isAltura ? '+ Agregar a Altura' : '+ Agregar a Alisto'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.adjustBtn, styles.adjustBtnSub]}
                            onPress={() => handleOpenAction(pos, 'SUB')}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.adjustBtnText}>- Registrar Merma/Daño</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Exclusivo pisos 1, 2, 3: Solicitar Reabastecimiento a Montacargas */}
                        {!isAltura && (
                          <TouchableOpacity
                            style={styles.reorderBtn}
                            onPress={() => {
                              // Wrap as a fake SolicitudAbasto structure
                              handleEscalateToMontacargas({
                                id: 0,
                                articulo_id: ARTICLE_IDS[pos.articulo],
                                articulo: pos.articulo,
                                solicitado_por: user?.id || 0,
                                solicitado_por_nombre: user?.nombre || '',
                                estado: 'PENDIENTE_INVENTARIO',
                                fecha_creacion: ''
                              });
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.reorderBtnText}>⚠️ Solicitar Reabastecimiento</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'abastecer' && (
          /* Abastecer (Proveedores) Tab */
          <View style={{ gap: 20 }}>
            {/* Input Picker Form */}
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>Orden de Abastecimiento</Text>
              <Text style={styles.formSubtitle}>
                Cargue inventario desde proveedores externos. La mercancía se almacenará en los pisos de Altura (4 y 5).
              </Text>

              {/* Custom Dropdown Selector */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Seleccionar Artículo</Text>
                <TouchableOpacity
                  style={styles.dropdownSelector}
                  onPress={() => {
                    setIsDropdownOpen(true);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={selectedSupplierArticle ? styles.dropdownTextSelected : styles.dropdownTextPlaceholder}>
                    {selectedSupplierArticle ? selectedSupplierArticle.nombre : 'Elija un artículo...'}
                  </Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>
              </View>

              {/* Quantity Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Cantidad a Recibir</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 50"
                  placeholderTextColor="#5C6B73"
                  keyboardType="numeric"
                  value={supplierQty}
                  onChangeText={(text) => {
                    setSupplierQty(text);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  editable={!isSubmitting}
                />
              </View>

              <TouchableOpacity
                style={styles.addToCartBtn}
                onPress={handleAddToSupplierCart}
                activeOpacity={0.8}
              >
                <Text style={styles.addToCartBtnText}>+ Agregar a la Orden</Text>
              </TouchableOpacity>
            </View>

            {/* Inbound Supplier List */}
            <View style={styles.cartCard}>
              <View style={styles.cartHeader}>
                <Text style={styles.cartTitle}>Detalle de Recepción</Text>
                {supplierCart.length > 0 && (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>{supplierCart.length}</Text>
                  </View>
                )}
              </View>

              {supplierCart.length === 0 ? (
                <Text style={styles.emptyCartText}>No hay artículos añadidos a la orden.</Text>
              ) : (
                <View style={styles.cartList}>
                  {supplierCart.map((item) => (
                    <View key={item.cart_id} style={styles.cartItem}>
                      <View style={styles.cartItemInfo}>
                        <Text style={styles.cartItemName}>{item.nombre}</Text>
                        <Text style={styles.cartItemQty}>Cantidad: {item.cantidad} uds</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => handleRemoveFromSupplierCart(item.cart_id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.removeBtnText}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity
                    style={[styles.button, isSubmitting && styles.buttonDisabled]}
                    onPress={handleConfirmSupplierInbound}
                    disabled={isSubmitting}
                    activeOpacity={0.8}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.buttonText}>
                        Confirmar Entrada de Mercancía ({supplierCart.length} {supplierCart.length === 1 ? 'artículo' : 'artículos'})
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {activeTab === 'movimientos' && (
          /* Historial de Movimientos Tab */
          <View style={styles.historyContainer}>
            <Text style={styles.sectionTitle}>Historial de Movimientos</Text>
            {movimientos.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No hay movimientos registrados.</Text>
              </View>
            ) : (
              movimientos.map((item) => {
                // Determine badge color
                let badgeColor = '#FFD166'; // Default AJUSTE (Yellow)
                if (item.tipo_movimiento === 'ENTRADA' || item.tipo_movimiento === 'REABASTECIMIENTO') {
                  badgeColor = '#06D6A0'; // Green
                } else if (item.tipo_movimiento === 'SALIDA') {
                  badgeColor = '#EF476F'; // Red
                }

                // Determine position text
                let positionsText = '';
                if (item.posicion_origen && item.posicion_destino) {
                  positionsText = `${item.posicion_origen} ➔ ${item.posicion_destino}`;
                } else if (item.posicion_origen) {
                  positionsText = `Origen: ${item.posicion_origen}`;
                } else if (item.posicion_destino) {
                  positionsText = `Destino: ${item.posicion_destino}`;
                } else {
                  positionsText = 'Ajuste general';
                }

                // Date formatting
                const dateFormatted = new Date(item.fecha).toLocaleString([], {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <View key={item.id} style={styles.historyCard}>
                    <View style={styles.historyCardHeader}>
                      <View style={[styles.typeBadge, { backgroundColor: badgeColor }]}>
                        <Text style={styles.typeBadgeText}>{item.tipo_movimiento}</Text>
                      </View>
                      <Text style={styles.historyQty}>{item.cantidad} Uds</Text>
                    </View>

                    <Text style={styles.historyArticleName}>{item.articulo_nombre}</Text>
                    
                    <View style={styles.historyDetailsRow}>
                      <Text style={styles.detailsTextLabel}>Ubicación:</Text>
                      <Text style={styles.detailsTextVal}>{positionsText}</Text>
                    </View>

                    <View style={styles.historyDetailsRow}>
                      <Text style={styles.detailsTextLabel}>Operario:</Text>
                      <Text style={styles.detailsTextVal}>{item.usuario_nombre}</Text>
                    </View>

                    <Text style={styles.historyDate}>{dateFormatted}</Text>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScrollView>

      {/* Adjustments Popup Modal */}
      <Modal
        visible={isModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => !isSubmitting && setIsModalOpen(false)}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalContent} {...{ onClick: (e: any) => e.stopPropagation() }}>
              <Text style={styles.modalTitle}>
                {actionType === 'ADD' ? 'Incremento de Stock' : 'Registrar Merma/Daño'}
              </Text>

              {selectedPos && (
                <View style={styles.modalInfoBox}>
                  <Text style={styles.modalInfoLabel}>Artículo: <Text style={styles.modalInfoVal}>{selectedPos.articulo}</Text></Text>
                  <Text style={styles.modalInfoLabel}>Rack: <Text style={styles.modalInfoVal}>{selectedPos.rack_nombre} - Piso {selectedPos.piso}</Text></Text>
                  <Text style={styles.modalInfoLabel}>Stock actual: <Text style={styles.modalInfoVal}>{selectedPos.cantidad_actual} uds</Text></Text>
                </View>
              )}

              {successMsg && (
                <View style={styles.successContainer}>
                  <Text style={styles.successText}>{successMsg}</Text>
                </View>
              )}

              {errorMsg && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              )}

              {!successMsg && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    {actionType === 'ADD' ? 'Cantidad a ingresar' : 'Cantidad de merma'}
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej. 10"
                    placeholderTextColor="#5C6B73"
                    keyboardType="numeric"
                    value={transactionQty}
                    onChangeText={(text) => {
                      setTransactionQty(text);
                      setErrorMsg(null);
                    }}
                    editable={!isSubmitting}
                  />
                </View>
              )}

              {!successMsg && (
                <View style={styles.modalButtonRow}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.modalButtonCancelText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonConfirm]}
                    onPress={handleTransaction}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.modalButtonConfirmText}>Aplicar Ajuste</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Supplier Article Picker Modal */}
      <Modal
        visible={isDropdownOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDropdownOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsDropdownOpen(false)}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalContent} {...{ onClick: (e: any) => e.stopPropagation() }}>
              <Text style={styles.modalTitle}>Seleccionar Artículo</Text>
              
              <ScrollView style={styles.modalList} nestedScrollEnabled>
                {ARTICLES.map((art) => (
                  <TouchableOpacity
                    key={art.id}
                    style={[
                      styles.modalItem,
                      selectedSupplierArticle?.id === art.id && styles.modalItemActive
                    ]}
                    onPress={() => {
                      setSelectedSupplierArticle(art);
                      setIsDropdownOpen(false);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.modalItemText,
                      selectedSupplierArticle?.id === art.id && styles.modalItemTextActive
                    ]}>
                      {art.nombre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setIsDropdownOpen(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.closeModalButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

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
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#22333B',
    backgroundColor: '#1C2541',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#FF336630',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF336660',
  },
  logoutButtonText: {
    color: '#FF3366',
    fontWeight: 'bold',
    fontSize: 13,
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
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#3A86C8',
  },
  tabText: {
    color: '#5C6B73',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tabTextActive: {
    color: '#3A86C8',
  },
  globalSuccessContainer: {
    backgroundColor: '#10B98120',
    borderColor: '#10B98150',
    borderWidth: 1,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 12,
  },
  globalSuccessText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  globalErrorContainer: {
    backgroundColor: '#FF336620',
    borderColor: '#FF336650',
    borderWidth: 1,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 15,
    borderRadius: 12,
  },
  globalErrorText: {
    color: '#FF3366',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollContainer: {
    padding: 20,
    gap: 20,
  },
  profileCard: {
    backgroundColor: '#1C2541',
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#22333B',
  },
  profileDetails: {
    flex: 1,
  },
  welcomeText: {
    color: '#3A86C8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  userEmail: {
    color: '#5C6B73',
    fontSize: 13,
  },
  badge: {
    backgroundColor: '#3A86C820',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A86C840',
  },
  badgeText: {
    color: '#3A86C8',
    fontWeight: 'bold',
    fontSize: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  requestsContainer: {
    backgroundColor: '#1C2541',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3A86C850',
  },
  requestsTitle: {
    color: '#3A86C8',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  requestsList: {
    gap: 10,
  },
  requestCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0B132B',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#22333B',
  },
  requestInfo: {
    flex: 1,
  },
  requestArtName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  requestDetails: {
    color: '#5C6B73',
    fontSize: 11,
  },
  escalateBtn: {
    backgroundColor: '#3A86C815',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A86C840',
  },
  escalateBtnText: {
    color: '#3A86C8',
    fontSize: 11,
    fontWeight: 'bold',
  },
  rackContainer: {
    backgroundColor: '#1C2541',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#22333B',
    overflow: 'hidden',
    marginBottom: 16,
  },
  rackHeader: {
    backgroundColor: '#22333B',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  rackTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  floorList: {
    padding: 16,
    gap: 16,
  },
  floorCard: {
    backgroundColor: '#0B132B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1C2541',
  },
  floorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  floorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  floorIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  floorIndicatorAltura: {
    backgroundColor: '#FF336620',
    borderWidth: 1,
    borderColor: '#FF336640',
  },
  floorIndicatorAlisto: {
    backgroundColor: '#3A86C820',
    borderWidth: 1,
    borderColor: '#3A86C840',
  },
  floorIndicatorText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  floorTypeText: {
    color: '#5C6B73',
    fontSize: 12,
  },
  floorRight: {
    alignItems: 'flex-end',
  },
  stockText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  articleName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#1C2541',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  adjustBtn: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustBtnAdd: {
    backgroundColor: '#10B98115',
    borderWidth: 1,
    borderColor: '#10B98140',
  },
  adjustBtnSub: {
    backgroundColor: '#FF336615',
    borderWidth: 1,
    borderColor: '#FF336640',
  },
  adjustBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  reorderBtn: {
    marginTop: 10,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5A62315',
    borderWidth: 1,
    borderColor: '#F5A62340',
  },
  reorderBtnText: {
    color: '#F5A623',
    fontWeight: 'bold',
    fontSize: 12,
  },
  formCard: {
    backgroundColor: '#1C2541',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#22333B',
  },
  formTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  formSubtitle: {
    color: '#5C6B73',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A86C8',
    marginBottom: 8,
  },
  input: {
    height: 52,
    backgroundColor: '#0B132B',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#22333B',
  },
  dropdownSelector: {
    height: 52,
    backgroundColor: '#0B132B',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#22333B',
  },
  dropdownTextPlaceholder: {
    color: '#5C6B73',
    fontSize: 16,
  },
  dropdownTextSelected: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  dropdownArrow: {
    color: '#3A86C8',
    fontSize: 12,
  },
  addToCartBtn: {
    height: 48,
    backgroundColor: '#1C2541',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#3A86C850',
  },
  addToCartBtnText: {
    color: '#3A86C8',
    fontSize: 15,
    fontWeight: 'bold',
  },
  cartCard: {
    backgroundColor: '#1C2541',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#22333B',
  },
  cartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cartTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cartBadge: {
    backgroundColor: '#3A86C8',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  emptyCartText: {
    color: '#5C6B73',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
  cartList: {
    gap: 12,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0B132B',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22333B',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cartItemQty: {
    color: '#5C6B73',
    fontSize: 13,
  },
  removeBtn: {
    backgroundColor: '#FF336615',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF336640',
  },
  removeBtnText: {
    color: '#FF3366',
    fontSize: 12,
    fontWeight: 'bold',
  },
  button: {
    height: 52,
    backgroundColor: '#3A86C8',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#3A86C8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#5C6B73',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 19, 43, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#1C2541',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#22333B',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInfoBox: {
    backgroundColor: '#0B132B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#22333B',
  },
  modalInfoLabel: {
    color: '#5C6B73',
    fontSize: 13,
  },
  modalInfoVal: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  inputGroupModal: {
    marginBottom: 20,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#22333B',
  },
  modalButtonCancelText: {
    color: '#5C6B73',
    fontWeight: 'bold',
  },
  modalButtonConfirm: {
    backgroundColor: '#3A86C8',
  },
  modalButtonConfirmText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: '#FF336620',
    borderColor: '#FF336650',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#FF3366',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  successContainer: {
    backgroundColor: '#10B98120',
    borderColor: '#10B98150',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  successText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Modal List picker styles
  modalList: {
    marginVertical: 8,
  },
  modalItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#22333B',
  },
  modalItemActive: {
    backgroundColor: '#3A86C815',
  },
  modalItemText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  modalItemTextActive: {
    color: '#3A86C8',
    fontWeight: 'bold',
  },
  closeModalButton: {
    marginTop: 16,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF336615',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF336630',
  },
  closeModalButtonText: {
    color: '#FF3366',
    fontWeight: 'bold',
    fontSize: 15,
  },
  historyContainer: {
    gap: 15,
    paddingBottom: 20,
  },
  historyCard: {
    backgroundColor: '#1C2541',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22333B',
    gap: 8,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeText: {
    color: '#0B132B',
    fontSize: 11,
    fontWeight: 'bold',
  },
  historyQty: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyArticleName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  historyDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsTextLabel: {
    color: '#5C6B73',
    fontSize: 12,
    width: 80,
  },
  detailsTextVal: {
    color: '#E0E1DD',
    fontSize: 12,
    flex: 1,
  },
  historyDate: {
    color: '#5C6B73',
    fontSize: 11,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C2541',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22333B',
  },
  emptyText: {
    color: '#5C6B73',
    fontSize: 14,
  },
});
