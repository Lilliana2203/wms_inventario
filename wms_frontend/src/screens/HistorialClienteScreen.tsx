import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Linking,
  Alert
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiCall, BASE_URL } from '../services/api';

interface OrderItem {
  articulo_id: number;
  articulo: string;
  cantidad: number;
}

interface Order {
  id: number;
  cliente_id: number;
  subtotal: string | number;
  impuesto_iva: string | number;
  impuesto: string | number;
  total: string | number;
  tipo_entrega: string;
  direccion_entrega: string | null;
  direccion_envio: string | null;
  telefono_contacto: string | null;
  estado: 'Pendiente' | 'Alistando' | 'Listo para Despacho' | 'Entregado';
  estado_detalle?: string;
  fecha_creacion: string;
  items?: OrderItem[];
}

export default function HistorialClienteScreen() {
  const { user, logout } = useAuth();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDownloadInvoice = async (orderId: number) => {
    try {
      const url = `${BASE_URL}/pedidos/${orderId}/exportar-pdf`;
      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening invoice PDF:', error);
      Alert.alert('Error', 'No se pudo descargar la factura PDF de este pedido.');
    }
  };

  const fetchOrders = async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    setErrorMsg(null);
    try {
      const response = await apiCall<Order[]>(`/inventario/pedidos/cliente/${user?.id}`, 'GET');
      if (response.success && response.data) {
        setOrders(response.data);
      } else {
        setErrorMsg(response.message || 'No se pudo cargar el historial.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión al servidor.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchOrders();
    }
  }, [user?.id]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchOrders(false);
  };

  const formatCRC = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return `₡${(num || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-CR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Entregado':
        return { bg: '#10B98120', border: '#10B98150', text: '#10B981' };
      case 'Listo para Despacho':
      case 'Listo':
        return { bg: '#8B5CF620', border: '#8B5CF650', text: '#A78BFA' };
      case 'Alistando':
      case 'En Alistado':
        return { bg: '#F59E0B20', border: '#F59E0B50', text: '#FBBF24' };
      case 'Pendiente':
      default:
        return { bg: '#3A86C820', border: '#3A86C840', text: '#60A5FA' };
    }
  };

  const renderOrderItem = ({ item }: { item: Order }) => {
    const statusDet = item.estado_detalle || item.estado;
    const statusStyle = getStatusColor(statusDet);

    return (
      <View style={styles.orderCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>Pedido #{item.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg, borderColor: statusStyle.border }]}>
            <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>{statusDet}</Text>
          </View>
        </View>

        <Text style={styles.orderDate}>{formatDate(item.fecha_creacion)}</Text>
        
        <View style={styles.cardDivider} />
        
        <View style={styles.detailsRow}>
          <Text style={styles.detailLabel}>Entrega:</Text>
          <Text style={styles.detailValue}>{item.tipo_entrega}</Text>
        </View>

        {item.telefono_contacto && (
          <View style={styles.detailsRow}>
            <Text style={styles.detailLabel}>Teléfono:</Text>
            <Text style={styles.detailValue}>{item.telefono_contacto}</Text>
          </View>
        )}

        {item.tipo_entrega === 'Express' && item.direccion_envio && (
          <View style={styles.addressContainer}>
            <Text style={styles.detailLabel}>Dirección de Envío:</Text>
            <Text style={styles.addressText}>{item.direccion_envio}</Text>
          </View>
        )}

        {item.items && item.items.length > 0 && (
          <View style={styles.productsContainer}>
            <Text style={styles.detailLabel}>Productos:</Text>
            <View style={styles.productsList}>
              {item.items.map((prod, idx) => (
                <Text key={idx} style={styles.productText}>
                  • {prod.cantidad}x {prod.articulo}
                </Text>
              ))}
            </View>
          </View>
        )}

        <View style={styles.cardDivider} />

        <View style={styles.monetarySummary}>
          <View style={styles.moneyRow}>
            <Text style={styles.moneyLabel}>Subtotal:</Text>
            <Text style={styles.moneyValue}>{formatCRC(item.subtotal)}</Text>
          </View>
          <View style={styles.moneyRow}>
            <Text style={styles.moneyLabel}>IVA (13%):</Text>
            <Text style={styles.moneyValue}>{formatCRC(item.impuesto || item.impuesto_iva)}</Text>
          </View>
          <View style={[styles.moneyRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Pagado:</Text>
            <Text style={styles.totalValue}>{formatCRC(item.total)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.downloadButton}
          onPress={() => handleDownloadInvoice(item.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.downloadButtonText}>📄 Descargar Factura PDF</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B132B" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Pedidos</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.7}>
          <Text style={styles.logoutButtonText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3A86C8" />
          <Text style={styles.loaderText}>Cargando historial...</Text>
        </View>
      ) : errorMsg ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchOrders()}>
            <Text style={styles.retryButtonText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : orders.length === 0 ? (
        <ScrollView
          contentContainerStyle={[styles.centered, { flexGrow: 1 }]}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#3A86C8" />
          }
        >
          <Text style={styles.emptyText}>Aún no tienes pedidos registrados.</Text>
          <Text style={styles.emptySubtitle}>Cuando realices compras en la pestaña catálogo, aparecerán aquí.</Text>
        </ScrollView>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderOrderItem}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#3A86C8" />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B132B',
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loaderText: {
    color: '#5C6B73',
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: '#FF3366',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3A86C8',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#5C6B73',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  listContainer: {
    padding: 20,
    gap: 16,
  },
  orderCard: {
    backgroundColor: '#1C2541',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#22333B',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderId: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusBadge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  orderDate: {
    color: '#5C6B73',
    fontSize: 13,
    marginBottom: 12,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#22333B',
    marginVertical: 12,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  detailLabel: {
    color: '#3A86C8',
    fontSize: 14,
    fontWeight: '500',
  },
  detailValue: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  addressContainer: {
    marginTop: 6,
    gap: 4,
  },
  addressText: {
    color: '#FFFFFF',
    fontSize: 13,
    backgroundColor: '#0B132B',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22333B',
    marginTop: 4,
  },
  productsContainer: {
    marginTop: 8,
    gap: 4,
  },
  productsList: {
    backgroundColor: '#0B132B',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22333B',
    marginTop: 4,
  },
  productText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
  },
  monetarySummary: {
    gap: 6,
  },
  moneyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moneyLabel: {
    color: '#5C6B73',
    fontSize: 13,
  },
  moneyValue: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  totalRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#22333B',
  },
  totalLabel: {
    color: '#3A86C8',
    fontSize: 14,
    fontWeight: 'bold',
  },
  totalValue: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: 'bold',
  },
  downloadButton: {
    backgroundColor: '#3A86C8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#3A86C8' + '50',
  },
  downloadButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  }
});
