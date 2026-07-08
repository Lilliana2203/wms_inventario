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

interface OrderItem {
  articulo_id: number;
  articulo: string;
  cantidad: number;
}

interface PendingOrder {
  id: number;
  cliente_id: number;
  cliente_nombre: string;
  estado: string;
  fecha_creacion: string;
  items: OrderItem[];
}

export default function DespachoPedidosScreen() {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const themeStyles = getThemeOverrides(colors);
  const [activeTab, setActiveTab] = useState<'pedidos' | 'mapa'>('pedidos');

  // State lists
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [racks, setRacks] = useState<{ [key: string]: RackPosition[] }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal / Transaction States for Map
  const [selectedPos, setSelectedPos] = useState<RackPosition | null>(null);
  const [transactionQty, setTransactionQty] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal / Checklist Dispatch States
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);
  const [checkedItems, setCheckedItems] = useState<{ [key: number]: boolean }>({});
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchOrdersAndMap = useCallback(async () => {
    try {
      const [ordersRes, racksRes] = await Promise.all([
        apiCall<PendingOrder[]>('/inventario/pedidos-alistador', 'GET'),
        apiCall<RackPosition[]>('/inventario/racks', 'GET')
      ]);

      if (ordersRes.success && ordersRes.data) {
        setPendingOrders(ordersRes.data);
      }

      if (racksRes.success && racksRes.data) {
        const grouped: { [key: string]: RackPosition[] } = {};
        racksRes.data.forEach((pos: RackPosition) => {
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
    } catch (e: any) {
      console.error('Error fetching orders or map:', e.message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrdersAndMap();
  }, [fetchOrdersAndMap]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrdersAndMap();
  };

  const handleOpenAction = (pos: RackPosition) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setTransactionQty('');
    setSelectedPos(pos);
    setIsModalOpen(true);
  };

  // Solicitar reabastecimiento a Inventario
  const handleRequestReplenish = async (pos: RackPosition) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const artId = ARTICLE_IDS[pos.articulo];
    if (!artId) {
      setErrorMsg('Error de mapeo: artículo no identificado');
      return;
    }

    try {
      const response = await apiCall<any>('/inventario/solicitar-abasto-inventario', 'POST', {
        usuario_id: user?.id,
        articulo_id: artId
      });

      if (response.success) {
        setSuccessMsg(response.message || `Solicitud de abasto enviada para ${pos.articulo}`);
        await fetchOrdersAndMap();
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(response.message || 'Error al solicitar reabastecimiento');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor');
    }
  };

  // Direct dispatch on map position
  const handleDirectTransaction = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedPos) return;

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
      const response = await apiCall<any>('/inventario/despachar', 'POST', {
        usuario_id: user?.id,
        articulo_id: artId,
        cantidad: qty
      });

      if (response.success) {
        setSuccessMsg(`Despacho exitoso: se restaron ${qty} unidades de "${selectedPos.articulo}".`);
        await fetchOrdersAndMap();
        setTimeout(() => {
          setIsModalOpen(false);
          setSelectedPos(null);
        }, 1500);
      } else {
        setErrorMsg(response.message || 'Error al procesar la transacción');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Picker selection handlers
  const handleSelectOrder = (order: PendingOrder) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSelectedOrder(order);
    const initialChecks: { [key: number]: boolean } = {};
    order.items.forEach((item) => {
      initialChecks[item.articulo_id] = false;
    });
    setCheckedItems(initialChecks);
    setIsDispatchModalOpen(true);
  };

  const handleToggleCheckItem = (articuloId: number) => {
    setCheckedItems((prev) => ({
      ...prev,
      [articuloId]: !prev[articuloId]
    }));
  };

  const isAllChecked = selectedOrder
    ? selectedOrder.items.every((item) => checkedItems[item.articulo_id])
    : false;

  const handleConfirmDispatch = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedOrder) return;
    if (!isAllChecked) {
      setErrorMsg('Debe confirmar físicamente la recogida de todos los artículos antes de despachar');
      return;
    }

    const calculatedLocation = selectedOrder.tipo_entrega === 'Express'
      ? 'Lugar 1 de Despacho (Envíos Express)'
      : 'Lugar 2 de Recolecta (Retiro en Sucursal)';

    setIsSubmitting(true);
    try {
      const response = await apiCall<any>('/inventario/completar-alistado', 'POST', {
        pedido_id: selectedOrder.id,
        ubicacion_despacho: calculatedLocation
      });

      if (response.success) {
        setSuccessMsg(response.message || `¡Pedido #${selectedOrder.id} alistado con éxito!`);
        await fetchOrdersAndMap();
        setTimeout(() => {
          setIsDispatchModalOpen(false);
          setSelectedOrder(null);
          setSuccessMsg(null);
        }, 1500);
      } else {
        setErrorMsg(response.message || 'Error al completar el alistado del pedido');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor');
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
        <Text style={[styles.headerTitle, themeStyles.headerTitle]}>Módulo de Alisto</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ThemeToggle />
          <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.7}>
            <Text style={styles.logoutButtonText}>Salir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'pedidos' && styles.tabButtonActive]}
          onPress={() => {
            setActiveTab('pedidos');
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'pedidos' && styles.tabTextActive]}>
            Despacho de Pedidos ({pendingOrders.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'mapa' && styles.tabButtonActive]}
          onPress={() => {
            setActiveTab('mapa');
            setErrorMsg(null);
            setSuccessMsg(null);
          }}
        >
          <Text style={[styles.tabText, activeTab === 'mapa' && styles.tabTextActive]}>
            Mapa de Bodega
          </Text>
        </TouchableOpacity>
      </View>

      {/* Global Alerts */}
      {successMsg && !isModalOpen && !isDispatchModalOpen && (
        <View style={styles.globalSuccessContainer}>
          <Text style={styles.globalSuccessText}>{successMsg}</Text>
        </View>
      )}
      {errorMsg && !isModalOpen && !isDispatchModalOpen && (
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
        <View style={styles.profileCard}>
          <View style={styles.profileDetails}>
            <Text style={styles.welcomeText}>Operario Autorizado</Text>
            <Text style={styles.userName}>{user?.nombre}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Alistador</Text>
          </View>
        </View>

        {activeTab === 'pedidos' ? (
          /* Pedidos view */
          <View style={styles.ordersSection}>
            <Text style={styles.sectionTitle}>Pedidos de Clientes Pendientes</Text>
            {pendingOrders.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No hay pedidos pendientes de despacho por clientes.</Text>
              </View>
            ) : (
              <View style={styles.ordersList}>
                {pendingOrders.map((order) => (
                  <View key={order.id} style={styles.orderCard}>
                    <View style={styles.orderHeader}>
                      <Text style={styles.orderIdText}>Pedido #{order.id}</Text>
                      <Text style={styles.orderDateText}>
                        {new Date(order.fecha_creacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <View style={styles.orderBody}>
                      <Text style={styles.orderClientLabel}>Cliente:</Text>
                      <Text style={styles.orderClientValue}>{order.cliente_nombre}</Text>
                      <Text style={styles.orderItemsCount}>
                        Contiene: {order.items.length} {order.items.length === 1 ? 'artículo' : 'artículos'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.dispatchSelectBtn}
                      onPress={() => handleSelectOrder(order)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dispatchSelectBtnText}>Iniciar Carrito de Despacho</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          /* Racks Map View for Alistador */
          <View style={{ gap: 20 }}>
            <Text style={styles.sectionTitle}>Distribución de Racks</Text>

            {Object.keys(racks).map((rackName) => (
              <View key={rackName} style={styles.rackContainer}>
                <View style={styles.rackHeader}>
                  <Text style={styles.rackTitle}>{rackName}</Text>
                </View>

                <View style={styles.floorList}>
                  {racks[rackName].map((pos) => {
                    const isAltura = pos.tipo_piso === 'Altura';
                    // Alistador cannot interact with Altura floors (4 & 5)
                    const isActionDisabled = isAltura;

                    const pct = Math.min((pos.cantidad_actual / pos.capacidad_maxima) * 100, 100);
                    const isOverStock = pos.cantidad_actual > pos.capacidad_maxima;

                    return (
                      <View key={pos.piso} style={styles.floorCard}>
                        <View style={styles.floorRow}>
                          <View style={styles.floorLeft}>
                            <View style={[styles.floorIndicator, isAltura ? styles.floorIndicatorAltura : styles.floorIndicatorAlisto]}>
                              <Text style={styles.floorIndicatorText}>Piso {pos.piso}</Text>
                            </View>
                            <Text style={styles.floorTypeText}>{pos.tipo_piso}</Text>
                          </View>

                          <View style={styles.floorRight}>
                            <Text style={styles.stockText}>
                              {pos.cantidad_actual} / {pos.capacidad_maxima} uds
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.articleName}>{pos.articulo}</Text>

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

                        {/* Role actions buttons */}
                        <View style={{ gap: 8 }}>
                          {!isActionDisabled && (
                            <TouchableOpacity
                              style={[styles.actionButton, styles.actionButtonAlistador]}
                              onPress={() => handleOpenAction(pos)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.actionButtonText}>Descontar del Alisto</Text>
                            </TouchableOpacity>
                          )}

                          {/* Request replenishment button */}
                          {!isAltura && (
                            <TouchableOpacity
                              style={styles.solicitudAbastoBtn}
                              onPress={() => handleRequestReplenish(pos)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.solicitudAbastoBtnText}>
                                ⚠️ Solicitar Reabastecimiento
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Direct transaction adjustment modal */}
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
              <Text style={styles.modalTitle}>Despacho de Pedido</Text>

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
                  <Text style={styles.label}>Cantidad a despachar</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej. 5"
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
                    onPress={handleDirectTransaction}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.modalButtonConfirmText}>Confirmar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Dispatch checklist modal (Carrito de Despacho) */}
      <Modal
        visible={isDispatchModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => !isSubmitting && setIsDispatchModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => !isSubmitting && setIsDispatchModalOpen(false)}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalContent} {...{ onClick: (e: any) => e.stopPropagation() }}>
              <Text style={styles.modalTitle}>Carrito de Despacho</Text>

              {selectedOrder && (
                <View style={styles.orderSummaryBox}>
                  <Text style={styles.orderSummaryTitle}>Pedido #{selectedOrder.id}</Text>
                  <Text style={styles.orderSummaryClient}>Cliente: {selectedOrder.cliente_nombre}</Text>
                </View>
              )}

              {selectedOrder && (
                <View style={styles.deliveryDetailsBox}>
                  <Text style={styles.deliveryDetailsTitle}>Información de Entrega</Text>
                  <View style={styles.deliveryDetailsRow}>
                    <Text style={styles.deliveryDetailsLabel}>Método:</Text>
                    <Text style={[styles.deliveryDetailsValue, styles.deliveryTypeHighlighted]}>
                      {selectedOrder.tipo_entrega === 'Express' ? '🚀 Envío Express' : '🏪 Retiro en Lugar'}
                    </Text>
                  </View>
                  {selectedOrder.telefono_contacto && (
                    <View style={styles.deliveryDetailsRow}>
                      <Text style={styles.deliveryDetailsLabel}>Teléfono:</Text>
                      <Text style={styles.deliveryDetailsValue}>{selectedOrder.telefono_contacto}</Text>
                    </View>
                  )}
                  {selectedOrder.tipo_entrega === 'Express' && selectedOrder.direccion_envio ? (
                    <View style={styles.expressAddressContainer}>
                      <Text style={styles.expressAddressLabel}>Dirección de Envío:</Text>
                      <Text style={styles.expressAddressText}>{selectedOrder.direccion_envio}</Text>
                    </View>
                  ) : selectedOrder.tipo_entrega === 'Retiro en Lugar' ? (
                    <View style={styles.expressAddressContainer}>
                      <Text style={styles.retailMessage}>🏬 El cliente recogerá el pedido en la sucursal.</Text>
                    </View>
                  ) : null}
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

              {!successMsg && selectedOrder && (
                <View style={styles.picklistContainer}>
                  <Text style={styles.pickInstruction}>
                    Marque cada artículo conforme lo retira físicamente de los pisos de alisto (1, 2, 3):
                  </Text>
                  
                  <ScrollView style={styles.pickList} nestedScrollEnabled>
                    {selectedOrder.items.map((item) => {
                      const isChecked = !!checkedItems[item.articulo_id];
                      return (
                        <TouchableOpacity
                          key={item.articulo_id}
                          style={[styles.pickItem, isChecked && styles.pickItemChecked]}
                          onPress={() => handleToggleCheckItem(item.articulo_id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.checkboxColumn}>
                            <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                              {isChecked && <Text style={styles.checkboxTick}>✓</Text>}
                            </View>
                          </View>
                          <View style={styles.pickItemDetails}>
                            <Text style={[styles.pickItemName, isChecked && styles.pickItemNameChecked]}>
                              {item.articulo}
                            </Text>
                            <Text style={styles.pickItemQty}>
                              Cantidad requerida: {item.cantidad} uds
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {selectedOrder && isAllChecked && (
                <View style={styles.placementInstructionBox}>
                  <Text style={styles.placementInstructionTitle}>📍 Ubicación de Despacho Automatizada</Text>
                  <Text style={styles.placementInstructionText}>
                    Favor colocar físicamente este pedido listo en:
                  </Text>
                  <View style={styles.placementTargetContainer}>
                    <Text style={styles.placementTargetText}>
                      {selectedOrder.tipo_entrega === 'Express'
                        ? 'Lugar 1 de Despacho (Envíos Express)'
                        : 'Lugar 2 de Recolecta (Retiro en Sucursal)'}
                    </Text>
                  </View>
                </View>
              )}

              {!successMsg && (
                <View style={styles.modalButtonRow}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => setIsDispatchModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.modalButtonCancelText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.modalButtonConfirm,
                      !isAllChecked && styles.modalButtonConfirmDisabled
                    ]}
                    onPress={handleConfirmDispatch}
                    disabled={isSubmitting || !isAllChecked}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.modalButtonConfirmText}>Confirmar Despacho</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
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
  actionButton: {
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonAlistador: {
    backgroundColor: '#FF336620',
    borderWidth: 1,
    borderColor: '#FF336640',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  solicitudAbastoBtn: {
    height: 36,
    backgroundColor: '#F5A62315',
    borderWidth: 1,
    borderColor: '#F5A62340',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  solicitudAbastoBtnText: {
    color: '#F5A623',
    fontSize: 12,
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
  inputGroup: {
    marginBottom: 20,
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
  modalButtonConfirmDisabled: {
    backgroundColor: '#5C6B73',
    opacity: 0.6,
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
  // Orders List Styles
  ordersSection: {
    gap: 16,
  },
  emptyCard: {
    backgroundColor: '#1C2541',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#22333B',
    alignItems: 'center',
  },
  emptyText: {
    color: '#5C6B73',
    fontSize: 14,
    textAlign: 'center',
  },
  ordersList: {
    gap: 16,
  },
  orderCard: {
    backgroundColor: '#1C2541',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#22333B',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#22333B',
    paddingBottom: 10,
    marginBottom: 12,
  },
  orderIdText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  orderDateText: {
    color: '#5C6B73',
    fontSize: 13,
  },
  orderBody: {
    marginBottom: 16,
  },
  orderClientLabel: {
    color: '#3A86C8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  orderClientValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  orderItemsCount: {
    color: '#5C6B73',
    fontSize: 13,
  },
  dispatchSelectBtn: {
    height: 44,
    backgroundColor: '#3A86C815',
    borderWidth: 1,
    borderColor: '#3A86C850',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dispatchSelectBtnText: {
    color: '#3A86C8',
    fontWeight: 'bold',
    fontSize: 14,
  },
  // Dispatch pick Modal styles
  orderSummaryBox: {
    backgroundColor: '#0B132B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#22333B',
  },
  orderSummaryTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  orderSummaryClient: {
    color: '#5C6B73',
    fontSize: 13,
  },
  picklistContainer: {
    marginBottom: 20,
  },
  pickInstruction: {
    color: '#5C6B73',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  pickList: {
    maxHeight: 180,
  },
  pickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#22333B',
  },
  pickItemChecked: {
    backgroundColor: '#10B98108',
  },
  checkboxColumn: {
    paddingRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#3A86C8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkboxTick: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  pickItemDetails: {
    flex: 1,
  },
  pickItemName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  pickItemNameChecked: {
    color: '#10B981',
    textDecorationLine: 'line-through',
  },
  pickItemQty: {
    color: '#5C6B73',
    fontSize: 12,
    marginTop: 2,
  },
  deliveryDetailsBox: {
    backgroundColor: '#0B132B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#22333B',
  },
  deliveryDetailsTitle: {
    color: '#3A86C8',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  deliveryDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  deliveryDetailsLabel: {
    color: '#5C6B73',
    fontSize: 13,
  },
  deliveryDetailsValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  deliveryTypeHighlighted: {
    color: '#F5A623',
  },
  expressAddressContainer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#22333B',
    paddingTop: 8,
  },
  expressAddressLabel: {
    color: '#5C6B73',
    fontSize: 12,
    marginBottom: 4,
  },
  expressAddressText: {
    color: '#FFFFFF',
    fontSize: 13,
    backgroundColor: '#1C2541',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A86C830',
  },
  retailMessage: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  placementInstructionBox: {
    backgroundColor: '#1E294B',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#3A86C850',
  },
  placementInstructionTitle: {
    color: '#A78BFA',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  placementInstructionText: {
    color: '#FFFFFF',
    fontSize: 13,
    marginBottom: 8,
  },
  placementTargetContainer: {
    backgroundColor: '#10B98120',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#10B98150',
    alignItems: 'center',
  },
  placementTargetText: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
