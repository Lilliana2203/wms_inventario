import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  Image
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiCall } from '../services/api';

interface CatalogArticle {
  id: number;
  nombre: string;
  precio_base: string;
  precio_con_iva: string | number;
  imagen_url: string;
}

interface CartItem {
  cart_id: string;
  articulo_id: number;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
}

export default function ComprasScreen() {
  const { user, logout } = useAuth();
  
  // Catalog articles state
  const [catalogList, setCatalogList] = useState<CatalogArticle[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  // Contact & Delivery states
  const [telefonoContacto, setTelefonoContacto] = useState('');
  const [tipoEntrega, setTipoEntrega] = useState<'Retiro en Lugar' | 'Express'>('Retiro en Lugar');
  const [isDeliveryDropdownOpen, setIsDeliveryDropdownOpen] = useState(false);
  const [direccionEnvio, setDireccionEnvio] = useState('');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Submission & Feedback states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch catalog on mount
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const res = await apiCall<CatalogArticle[]>('/inventario/catalogo', 'GET');
        if (res.success && res.data) {
          setCatalogList(res.data);
        }
      } catch (err) {
        console.error('Error fetching catalog:', err);
      } finally {
        setIsLoadingCatalog(false);
      }
    };
    fetchCatalog();
    setErrorMsg(null);
    setSuccessMsg(null);
  }, []);

  const handleDirectAddToCart = (item: CatalogArticle) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const price = parseFloat(item.precio_base) || 0;

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((c) => c.articulo_id === item.id);
      if (existingIndex > -1) {
        const newCart = [...prevCart];
        newCart[existingIndex].cantidad += 1;
        return newCart;
      } else {
        return [
          ...prevCart,
          {
            cart_id: Date.now().toString() + Math.random().toString(),
            articulo_id: item.id,
            nombre: item.nombre,
            cantidad: 1,
            precio_unitario: price
          }
        ];
      }
    });

    setSuccessMsg(`¡${item.nombre} agregado al carrito!`);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleRemoveFromCart = (cartId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setCart((prevCart) => prevCart.filter((item) => item.cart_id !== cartId));
  };

  // Calculations for Costa Rican colon (₡) and 13% IVA
  const subtotal = cart.reduce((sum, item) => sum + (item.precio_unitario * item.cantidad), 0);
  const impuesto = subtotal * 0.13;
  const total = subtotal + impuesto;

  // Format currency helpers
  const formatCRC = (val: number) => {
    return `₡${val.toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCRCWithIva = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    const rounded = Math.round(num || 0);
    const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `₡${formatted} con IVA`;
  };

  const handleEmitOrder = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (cart.length === 0) {
      setErrorMsg('El carrito está vacío');
      return;
    }

    if (!telefonoContacto.trim()) {
      setErrorMsg('El teléfono de contacto es obligatorio');
      return;
    }

    if (tipoEntrega === 'Express' && !direccionEnvio.trim()) {
      setErrorMsg('La dirección de envío es obligatoria para entregas Express');
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsPayload = cart.map((item) => ({
        articulo_id: item.articulo_id,
        cantidad: item.cantidad
      }));

      const response = await apiCall<any>('/inventario/comprar', 'POST', {
        usuario_id: user?.id,
        items: itemsPayload,
        tipo_entrega: tipoEntrega,
        telefono_contacto: telefonoContacto.trim(),
        direccion_envio: tipoEntrega === 'Express' ? direccionEnvio.trim() : null
      });

      if (response.success) {
        if (tipoEntrega === 'Retiro en Lugar') {
          Alert.alert(
            "ℹ️ Pedido Registrado",
            "Tu pedido ha sido registrado. Podrás recogerlo en la zona de recolecta de la sucursal una vez esté listo.",
            [{ text: "Entendido" }]
          );
        } else {
          Alert.alert(
            "🚀 Pedido en Camino",
            "Tu pedido Express ha sido registrado con éxito.",
            [{ text: "Excelente" }]
          );
        }

        setSuccessMsg(response.message || '¡Compra realizada con éxito!');
        setCart([]);
        setTelefonoContacto('');
        setDireccionEnvio('');
        setTipoEntrega('Retiro en Lugar');
      } else {
        setErrorMsg(response.message || 'Error al procesar la compra');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión al servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0B132B" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Catálogo de Compras</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.7}>
          <Text style={styles.logoutButtonText}>Salir</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          <View style={styles.profileCard}>
            <View style={styles.profileDetails}>
              <Text style={styles.welcomeText}>Cliente Autorizado</Text>
              <Text style={styles.userName}>{user?.nombre}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Cliente</Text>
            </View>
          </View>

          {/* Product Catalog Grid Card */}
          <View style={styles.catalogCard}>
            <Text style={styles.catalogTitle}>Catálogo de Productos</Text>
            <Text style={styles.catalogSubtitle}>
              Seleccione y agregue herramientas directamente a su carrito de compras.
            </Text>

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

            {isLoadingCatalog ? (
              <View style={styles.loaderContainer}>
                <ActivityIndicator color="#3A86C8" size="large" />
                <Text style={styles.loaderText}>Cargando catálogo...</Text>
              </View>
            ) : (
              <View style={styles.gridContainer}>
                {catalogList.map((item) => (
                  <View key={item.id} style={styles.productCard}>
                    <Image 
                      source={{ uri: item.imagen_url }} 
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                    <View style={styles.productInfo}>
                      <Text style={styles.productName} numberOfLines={2}>
                        {item.nombre}
                      </Text>
                      <Text style={styles.productPriceConIva}>
                        {formatCRCWithIva(item.precio_con_iva)}
                      </Text>
                      <Text style={styles.productPriceBase}>
                        Base: {formatCRC(parseFloat(item.precio_base))}
                      </Text>
                      
                      <TouchableOpacity
                        style={styles.addProductBtn}
                        onPress={() => handleDirectAddToCart(item)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.addProductBtnText}>+ Agregar al Carrito</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Cart View Card */}
          <View style={styles.cartCard}>
            <View style={styles.cartHeader}>
              <Text style={styles.cartTitle}>Carrito de Compras</Text>
              {cart.length > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cart.length}</Text>
                </View>
              )}
            </View>

            {cart.length === 0 ? (
              <Text style={styles.emptyCartText}>El carrito está vacío. Agregue artículos arriba.</Text>
            ) : (
              <View style={styles.cartList}>
                {cart.map((item) => (
                  <View key={item.cart_id} style={styles.cartItem}>
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName}>{item.nombre}</Text>
                      <Text style={styles.cartItemQty}>Cantidad: {item.cantidad}</Text>
                      <Text style={styles.cartItemPrice}>Unitario: {formatCRC(item.precio_unitario)}</Text>
                      <Text style={styles.cartItemSubtotal}>Subtotal: {formatCRC(item.precio_unitario * item.cantidad)}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => handleRemoveFromCart(item.cart_id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.removeBtnText}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Contact and Delivery Details */}
                <View style={styles.detailsDivider} />
                <Text style={styles.sectionTitle}>Detalles de Entrega</Text>

                {/* Contact Phone */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Teléfono de Contacto (Obligatorio)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej. 8888-8888"
                    placeholderTextColor="#5C6B73"
                    keyboardType="phone-pad"
                    value={telefonoContacto}
                    onChangeText={(text) => {
                      setTelefonoContacto(text);
                      setErrorMsg(null);
                    }}
                    editable={!isSubmitting}
                  />
                </View>

                {/* Delivery Method Dropdown */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Método de Entrega</Text>
                  <TouchableOpacity
                    style={styles.dropdownSelector}
                    onPress={() => {
                      setIsDeliveryDropdownOpen(true);
                      setErrorMsg(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dropdownTextSelected}>
                      {tipoEntrega}
                    </Text>
                    <Text style={styles.dropdownArrow}>▼</Text>
                  </TouchableOpacity>
                </View>

                {/* Dynamic Shipping Address Input */}
                {tipoEntrega === 'Express' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Dirección de Envío (Obligatorio)</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Ingrese la dirección completa para el envío Express..."
                      placeholderTextColor="#5C6B73"
                      multiline={true}
                      numberOfLines={3}
                      value={direccionEnvio}
                      onChangeText={(text) => {
                        setDireccionEnvio(text);
                        setErrorMsg(null);
                      }}
                      editable={!isSubmitting}
                    />
                  </View>
                )}

                {/* Order Summary Breakdowns */}
                <View style={styles.summaryContainer}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal:</Text>
                    <Text style={styles.summaryValue}>{formatCRC(subtotal)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>IVA (13%):</Text>
                    <Text style={styles.summaryValue}>{formatCRC(impuesto)}</Text>
                  </View>
                  <View style={[styles.summaryRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>TOTAL A PAGAR:</Text>
                    <Text style={styles.totalValue}>{formatCRC(total)}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.button, isSubmitting && styles.buttonDisabled]}
                  onPress={handleEmitOrder}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>
                      Emitir Orden de Compra ({formatCRC(total)})
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Delivery Method Selection Dropdown Overlay */}
      <Modal
        visible={isDeliveryDropdownOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDeliveryDropdownOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsDeliveryDropdownOpen(false)}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalContent} {...{ onClick: (e: any) => e.stopPropagation() }}>
              <Text style={styles.modalTitle}>Seleccionar Método de Entrega</Text>
              
              <TouchableOpacity
                style={[styles.modalItem, tipoEntrega === 'Retiro en Lugar' && styles.modalItemActive]}
                onPress={() => {
                  setTipoEntrega('Retiro en Lugar');
                  setIsDeliveryDropdownOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalItemText, tipoEntrega === 'Retiro en Lugar' && styles.modalItemTextActive]}>
                  Retiro en Lugar (Sucursal)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalItem, tipoEntrega === 'Express' && styles.modalItemActive]}
                onPress={() => {
                  setTipoEntrega('Express');
                  setIsDeliveryDropdownOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalItemText, tipoEntrega === 'Express' && styles.modalItemTextActive]}>
                  Envío Express
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setIsDeliveryDropdownOpen(false)}
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
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A86C840',
  },
  badgeText: {
    color: '#3A86C8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Catalog styles
  catalogCard: {
    backgroundColor: '#1C2541',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#22333B',
  },
  catalogTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  catalogSubtitle: {
    color: '#5C6B73',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 8,
  },
  productCard: {
    width: '48%',
    backgroundColor: '#0B132B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#22333B',
    overflow: 'hidden',
    marginBottom: 8,
  },
  productImage: {
    width: '100%',
    height: 110,
    backgroundColor: '#1C2541',
  },
  productInfo: {
    padding: 10,
    gap: 4,
  },
  productName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    height: 34,
  },
  productPriceConIva: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: 'bold',
  },
  productPriceBase: {
    color: '#5C6B73',
    fontSize: 10,
  },
  addProductBtn: {
    backgroundColor: '#3A86C8',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
    marginTop: 6,
  },
  addProductBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  // Cart Card styles
  cartCard: {
    backgroundColor: '#1C2541',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#22333B',
    marginBottom: 20,
  },
  cartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  cartTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cartBadge: {
    backgroundColor: '#3A86C8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyCartText: {
    color: '#5C6B73',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  cartList: {
    gap: 16,
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
    gap: 2,
  },
  cartItemName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cartItemQty: {
    color: '#A78BFA',
    fontSize: 13,
  },
  cartItemPrice: {
    color: '#5C6B73',
    fontSize: 12,
  },
  cartItemSubtotal: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: 'bold',
  },
  removeBtn: {
    backgroundColor: '#FF336615',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF336630',
  },
  removeBtnText: {
    color: '#FF3366',
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailsDivider: {
    height: 1,
    backgroundColor: '#22333B',
    marginVertical: 10,
  },
  sectionTitle: {
    color: '#A78BFA',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  inputGroup: {
    gap: 6,
    marginBottom: 14,
  },
  label: {
    color: '#3A86C8',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0B132B',
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#22333B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  dropdownSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0B132B',
    borderWidth: 1,
    borderColor: '#22333B',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownTextSelected: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownArrow: {
    color: '#5C6B73',
    fontSize: 12,
  },
  summaryContainer: {
    backgroundColor: '#0B132B',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22333B',
    gap: 8,
    marginTop: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#5C6B73',
    fontSize: 13,
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#22333B',
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    color: '#A78BFA',
    fontSize: 14,
    fontWeight: 'bold',
  },
  totalValue: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  loaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  loaderText: {
    color: '#5C6B73',
    fontSize: 14,
  },
  successContainer: {
    backgroundColor: '#10B98115',
    borderWidth: 1,
    borderColor: '#10B98130',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  successText: {
    color: '#10B981',
    fontSize: 13,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#FF336615',
    borderWidth: 1,
    borderColor: '#FF336630',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#FF3366',
    fontSize: 13,
    textAlign: 'center',
  },
  // Modal Overlays
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000AA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: '#1C2541',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#22333B',
    padding: 20,
    gap: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#22333B',
  },
  modalItemActive: {
    backgroundColor: '#3A86C815',
  },
  modalItemText: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
  },
  modalItemTextActive: {
    color: '#3A86C8',
    fontWeight: 'bold',
  },
  closeModalButton: {
    backgroundColor: '#FF336630',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#FF336660',
  },
  closeModalButtonText: {
    color: '#FF3366',
    fontSize: 14,
    fontWeight: 'bold',
  }
});
