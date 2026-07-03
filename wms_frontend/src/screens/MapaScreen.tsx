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
import { apiCall } from '../services/api';

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
  id: number;
  rack_nombre: string;
  piso: number;
  tipo_piso: 'Alisto' | 'Altura';
  articulo: string;
  cantidad_actual: number;
  capacidad_maxima: number;
}

interface PendingTask {
  id: number;
  articulo_id: number;
  articulo: string;
  solicitado_por: number;
  solicitado_por_nombre: string;
  estado: string;
  fecha_creacion: string;
}

interface OrderItem {
  articulo_id: number;
  articulo: string;
  cantidad: number;
}

interface PendingOrder {
  id: number;
  cliente_id: number;
  cliente_name?: string; // mapping fallback
  cliente_nombre: string;
  estado: string;
  fecha_creacion: string;
  items: OrderItem[];
}

export default function MapaScreen() {
  const { user, logout } = useAuth();
  const isAlistador = user?.rol_id === 2; // Rol 2: Alistador. Rol 3: Montacargas

  // Navigation tab for Alistador
  const [activeTab, setActiveTab] = useState<'mapa' | 'pedidos'>('mapa');

  // Inventory data states
  const [racks, setRacks] = useState<{ [key: string]: RackPosition[] }>({});
  const [pendingTasks, setPendingTasks] = useState<PendingTask[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal / Transaction States for Map
  const [selectedPos, setSelectedPos] = useState<RackPosition | null>(null);
  const [selectedTask, setSelectedTask] = useState<PendingTask | null>(null);
  const [selectedTargetPosId, setSelectedTargetPosId] = useState<number | null>(null);
  const [transactionQty, setTransactionQty] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal / Dispatch Picker States
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);
  const [checkedItems, setCheckedItems] = useState<{ [key: number]: boolean }>({});
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchRacksMap = useCallback(async () => {
    try {
      const promises: [Promise<any>, Promise<any> | null, Promise<any> | null] = [
        apiCall<RackPosition[]>('/inventario/racks', 'GET'),
        !isAlistador ? apiCall<any>('/inventario/tareas-pendientes', 'GET') : null,
        isAlistador ? apiCall<any>('/inventario/pedidos-pendientes', 'GET') : null
      ];

      const [racksResponse, tasksResponse, ordersResponse] = await Promise.all(promises);

      if (racksResponse.success && racksResponse.data) {
        const grouped: { [key: string]: RackPosition[] } = {};
        racksResponse.data.forEach((pos: RackPosition) => {
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

      if (tasksResponse && tasksResponse.success && tasksResponse.data) {
        setPendingTasks(tasksResponse.data);
      }

      if (ordersResponse && ordersResponse.success && ordersResponse.data) {
        setPendingOrders(ordersResponse.data);
      }
    } catch (e: any) {
      console.error('Error fetching racks map or tasks:', e.message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [isAlistador]);

  useEffect(() => {
    fetchRacksMap();
  }, [fetchRacksMap]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRacksMap();
  };

  const handleOpenAction = (pos: RackPosition) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setTransactionQty('');
    setSelectedPos(pos);
    setSelectedTask(null);
    setSelectedTargetPosId(null);
    setIsModalOpen(true);
  };

  const handleOpenTaskAction = (task: PendingTask) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setTransactionQty('');
    setSelectedPos(null);
    setSelectedTask(task);
    setSelectedTargetPosId(null);
    setIsModalOpen(true);
  };

  // Alistador requests replenishment to Inventario (writes to solicitudes_reabastecimiento)
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
        // Clear message after 3s
        setTimeout(() => setSuccessMsg(null), 3000);
      } else {
        setErrorMsg(response.message || 'Error al solicitar reabastecimiento');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor');
    }
  };

  // Map Direct Action (Direct Dispatch or Direct Replenish)
  const handleTransaction = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const qty = parseInt(transactionQty, 10);
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg('Debe ingresar una cantidad mayor a cero');
      return;
    }

    setIsSubmitting(true);
    try {
      let endpoint = '';
      let body: any = {
        usuario_id: user?.id,
        cantidad: qty
      };

      if (isAlistador) {
        // Direct Dispatch (for Alistador)
        if (!selectedPos) {
          setErrorMsg('Error: No se seleccionó la posición de origen');
          setIsSubmitting(false);
          return;
        }
        const artId = ARTICLE_IDS[selectedPos.articulo];
        if (!artId) {
          setErrorMsg('Error de mapeo: artículo no identificado');
          setIsSubmitting(false);
          return;
        }
        endpoint = '/inventario/despachar';
        body.articulo_id = artId;
      } else {
        // Replenishment (for Montacargas)
        if (!selectedTargetPosId) {
          setErrorMsg('Debe seleccionar un piso de Alisto destino');
          setIsSubmitting(false);
          return;
        }
        endpoint = '/inventario/reabastecer';
        body.posicion_id = selectedTargetPosId;
      }

      const response = await apiCall<any>(endpoint, 'POST', body);

      if (response.success) {
        const articleName = selectedPos ? selectedPos.articulo : (selectedTask ? selectedTask.articulo : '');
        setSuccessMsg(
          isAlistador
            ? `Despacho exitoso: se restaron ${qty} unidades de "${articleName}".`
            : `Reabastecimiento exitoso: se transfirieron ${qty} unidades de "${articleName}".`
        );
        await fetchRacksMap();
        setTimeout(() => {
          setIsModalOpen(false);
          setSelectedPos(null);
          setSelectedTask(null);
          setSelectedTargetPosId(null);
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

  // Order Picker selection handlers
  const handleSelectOrder = (order: PendingOrder) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSelectedOrder(order);
    // Initialize checkboxes to false
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

    setIsSubmitting(true);
    try {
      const response = await apiCall<any>('/inventario/despachar', 'POST', {
        usuario_id: user?.id,
        pedido_id: selectedOrder.id
      });

      if (response.success) {
        setSuccessMsg(`¡Pedido #${selectedOrder.id} despachado y registrado con éxito!`);
        await fetchRacksMap();
        setTimeout(() => {
          setIsDispatchModalOpen(false);
          setSelectedOrder(null);
        }, 1500);
      } else {
        setErrorMsg(response.message || 'Error al despachar el pedido');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A86C8" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B132B" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isAlistador ? 'Módulo de Alisto' : 'Mapa de Bodega'}
        </Text>
        <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.7}>
          <Text style={styles.logoutButtonText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Alistador Tab Bar */}
      {isAlistador && (
        <View style={styles.tabContainer}>
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
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'pedidos' && styles.tabButtonActive]}
            onPress={() => {
              setActiveTab('pedidos');
              setErrorMsg(null);
              setSuccessMsg(null);
              fetchRacksMap(); // reload orders
            }}
          >
            <Text style={[styles.tabText, activeTab === 'pedidos' && styles.tabTextActive]}>
              Despacho de Pedidos ({pendingOrders.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Global Feedback messages */}
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
            <Text style={styles.badgeText}>
              {isAlistador ? 'Alistador' : 'Montacargas'}
            </Text>
          </View>
        </View>

        {/* Tab content conditional rendering */}
        {isAlistador && activeTab === 'pedidos' ? (
          /* Pedidos view for Alistador */
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
          /* Normal Racks Map view (Alistador or Montacargas) */
          <View style={{ gap: 20 }}>
            {/* Tareas de Reabastecimiento Pendientes Widget (Only for Montacargas) */}
            {!isAlistador && pendingTasks.length > 0 && (
              <View style={styles.tasksContainer}>
                <Text style={styles.tasksTitle}>⚠️ Reabastecimientos Pendientes</Text>
                <View style={styles.tasksList}>
                  {pendingTasks.map((task) => (
                    <TouchableOpacity
                      key={task.id}
                      style={styles.taskCard}
                      onPress={() => handleOpenTaskAction(task)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.taskInfo}>
                        <Text style={styles.taskArtName}>{task.articulo}</Text>
                        <Text style={styles.taskDetails}>Solicitado por: {task.solicitado_por_nombre}</Text>
                      </View>
                      <View style={styles.taskBadge}>
                        <Text style={styles.taskBadgeText}>Pendiente</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <Text style={styles.sectionTitle}>Distribución de Racks</Text>

            {/* Rack Maps */}
            {Object.keys(racks).map((rackName) => (
              <View key={rackName} style={styles.rackContainer}>
                <View style={styles.rackHeader}>
                  <Text style={styles.rackTitle}>{rackName}</Text>
                </View>

                <View style={styles.floorList}>
                  {racks[rackName].map((pos) => {
                    const isAltura = pos.tipo_piso === 'Altura';
                    // Roles validations for buttons
                    const isActionDisabled = isAlistador ? isAltura : !isAltura;

                    const pct = Math.min((pos.cantidad_actual / pos.capacidad_maxima) * 100, 100);
                    const isOverStock = pos.cantidad_actual > pos.capacidad_maxima;

                    return (
                      <View key={pos.id} style={styles.floorCard}>
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
                              style={[
                                styles.actionButton,
                                isAlistador ? styles.actionButtonAlistador : styles.actionButtonMontacargas
                              ]}
                              onPress={() => handleOpenAction(pos)}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.actionButtonText}>
                                {isAlistador ? 'Descontar del Alisto' : 'Bajar a Alisto (Reabastecer)'}
                              </Text>
                            </TouchableOpacity>
                          )}

                          {/* Alistador Request Replenishment Button */}
                          {isAlistador && !isAltura && (
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

      {/* Transaction Popup (Modal) */}
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
              {isAlistador ? 'Despacho de Pedido' : 'Reabastecer Alisto'}
            </Text>

            {(selectedPos || selectedTask) && (
              <View style={styles.modalInfoBox}>
                <Text style={styles.modalInfoLabel}>
                  Artículo:{' '}
                  <Text style={styles.modalInfoVal}>
                    {selectedPos ? selectedPos.articulo : selectedTask?.articulo}
                  </Text>
                </Text>
                {selectedPos && (
                  <>
                    <Text style={styles.modalInfoLabel}>
                      Rack Origen:{' '}
                      <Text style={styles.modalInfoVal}>
                        {selectedPos.rack_nombre} - Piso {selectedPos.piso} ({selectedPos.tipo_piso})
                      </Text>
                    </Text>
                    <Text style={styles.modalInfoLabel}>
                      Stock Origen:{' '}
                      <Text style={styles.modalInfoVal}>{selectedPos.cantidad_actual} uds</Text>
                    </Text>
                  </>
                )}
                {selectedTask && (
                  <Text style={styles.modalInfoLabel}>
                    Origen (Altura):{' '}
                    <Text style={styles.modalInfoVal}>Bodega (Cualquier posición de Altura disponible)</Text>
                  </Text>
                )}
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
              <>
                {!isAlistador && (
                  <View style={styles.destinationPickerContainer}>
                    <Text style={styles.label}>Piso de Alisto Destino:</Text>
                    {(() => {
                      const articleName = selectedPos ? selectedPos.articulo : (selectedTask ? selectedTask.articulo : '');

                      // Filter positions in racks for this article and Alisto
                      const alistoPositions: RackPosition[] = [];
                      Object.values(racks).forEach((rackPositions) => {
                        rackPositions.forEach((pos) => {
                          if (pos.articulo === articleName && pos.tipo_piso === 'Alisto') {
                            alistoPositions.push(pos);
                          }
                        });
                      });

                      // Sort them to assign Slot A, B, C consistently
                      alistoPositions.sort((a, b) => a.id - b.id);

                      if (alistoPositions.length === 0) {
                        return (
                          <Text style={styles.noDestinationsText}>
                            No hay posiciones de Alisto asignadas para este artículo.
                          </Text>
                        );
                      }

                      return alistoPositions.map((pos, index) => {
                        const slotLetter = String.fromCharCode(65 + index); // A, B, C...
                        const isSelected = selectedTargetPosId === pos.id;
                        const isFull = pos.cantidad_actual >= pos.capacidad_maxima;

                        const label = `${pos.rack_nombre} - Piso ${pos.piso} (Slot ${slotLetter}) [${pos.cantidad_actual}/${pos.capacidad_maxima} uds]${pos.cantidad_actual === 0 ? ' [Vacío]' : isFull ? ' [Lleno]' : ''}`;

                        return (
                          <TouchableOpacity
                            key={pos.id}
                            style={[
                              styles.destinationOption,
                              isSelected && styles.destinationOptionSelected,
                              isFull && styles.destinationOptionFull,
                            ]}
                            onPress={() => {
                              setSelectedTargetPosId(pos.id);
                              setErrorMsg(null);
                            }}
                            activeOpacity={0.7}
                            disabled={isSubmitting}
                          >
                            <View style={styles.destinationOptionRow}>
                              <View
                                style={[
                                  styles.radioCircle,
                                  isSelected && styles.radioCircleSelected,
                                ]}
                              />
                              <Text
                                style={[
                                  styles.destinationOptionText,
                                  isSelected && styles.destinationOptionTextSelected,
                                ]}
                              >
                                {label}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      });
                    })()}
                  </View>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Cantidad a mover/despachar</Text>
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
              </>
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
                    <Text style={styles.modalButtonConfirmText}>Confirmar</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Dispatch Pick List Modal (Carrito de Despacho) */}
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

            {/* List of items with checklists */}
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

            {/* Action buttons */}
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
  tasksContainer: {
    backgroundColor: '#1C2541',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F5A62350',
  },
  tasksTitle: {
    color: '#F5A623',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  tasksList: {
    gap: 10,
  },
  taskCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0B132B',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#22333B',
  },
  taskInfo: {
    flex: 1,
  },
  taskArtName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  taskDetails: {
    color: '#5C6B73',
    fontSize: 11,
  },
  taskBadge: {
    backgroundColor: '#F5A62320',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#F5A62340',
  },
  taskBadgeText: {
    color: '#F5A623',
    fontSize: 11,
    fontWeight: 'bold',
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
  actionRow: {
    flexDirection: 'row',
  },
  actionButton: {
    flex: 1,
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
  actionButtonMontacargas: {
    backgroundColor: '#10B98120',
    borderWidth: 1,
    borderColor: '#10B98140',
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
  // Orders Screen styles
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
  destinationPickerContainer: {
    marginTop: 15,
    marginBottom: 15,
    width: '100%',
  },
  noDestinationsText: {
    color: '#FF3366',
    fontSize: 13,
    marginTop: 5,
  },
  destinationOption: {
    backgroundColor: '#1C2541',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#22333B',
    padding: 12,
    marginTop: 8,
  },
  destinationOptionSelected: {
    borderColor: '#3A86C8',
    backgroundColor: '#3A86C810',
  },
  destinationOptionFull: {
    opacity: 0.6,
  },
  destinationOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#5C6B73',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: '#3A86C8',
    backgroundColor: '#3A86C8',
  },
  destinationOptionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  destinationOptionTextSelected: {
    color: '#3A86C8',
    fontWeight: 'bold',
  },
});


