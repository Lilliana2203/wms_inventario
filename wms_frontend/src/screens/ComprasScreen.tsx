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
import { useTheme } from '../context/ThemeContext';
import { apiCall } from '../services/api';
import ThemeToggle from '../components/ThemeToggle';

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

interface ComprasScreenProps {
  onNavigateToLogin?: () => void;
}

export default function ComprasScreen({ onNavigateToLogin }: ComprasScreenProps) {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  
  // Catalog articles state
  const [catalogList, setCatalogList] = useState<CatalogArticle[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  // Detail Modal state
  const [selectedArticleForDetail, setSelectedArticleForDetail] = useState<CatalogArticle | null>(null);
  const [detailQuantity, setDetailQuantity] = useState(1);

  // Contact & Delivery states
  const [telefonoContacto, setTelefonoContacto] = useState('');
  const [tipoEntrega, setTipoEntrega] = useState<'Retiro en Lugar' | 'Express'>('Retiro en Lugar');
  const [isDeliveryDropdownOpen, setIsDeliveryDropdownOpen] = useState(false);
  const [direccionEnvio, setDireccionEnvio] = useState('');
  const [enGAM, setEnGAM] = useState(true); // Default to true for GAM
  const [provincia, setProvincia] = useState('San José'); // Default GAM province
  const [isProvinceDropdownOpen, setIsProvinceDropdownOpen] = useState(false);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Payment Modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');

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

  const showAlert = (title: string, message: string, buttons?: any[]) => {
    if (Platform.OS === 'web') {
      if (buttons && buttons.length > 0) {
        const confirmBtn = buttons.find(b => b.onPress);
        if (confirmBtn && confirmBtn.text !== "Cancelar" && confirmBtn.text !== "Excellent" && confirmBtn.text !== "Excelente") {
          const ok = window.confirm(`${title}\n\n${message}`);
          if (ok && confirmBtn.onPress) {
            confirmBtn.onPress();
          }
        } else {
          window.alert(`${title}\n\n${message}`);
        }
      } else {
        window.alert(`${title}\n\n${message}`);
      }
    } else {
      Alert.alert(title, message, buttons);
    }
  };

  const showSecurityAlert = () => {
    setErrorMsg("Debes registrarte o iniciar sesión en la web antes de poder realizar una compra");
    showAlert(
      "Por motivos de seguridad",
      "Debes registrarte o iniciar sesión en la web antes de poder realizar una compra",
      [
        { text: "Cancelar", style: "cancel" },
        ...(onNavigateToLogin ? [{ text: "Iniciar Sesión", onPress: onNavigateToLogin }] : [])
      ]
    );
  };

  const handleAddQuantityToCart = (item: CatalogArticle, quantity: number) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!user) {
      showSecurityAlert();
      return;
    }

    const price = parseFloat(item.precio_base) || 0;

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((c) => c.articulo_id === item.id);
      if (existingIndex > -1) {
        const newCart = [...prevCart];
        newCart[existingIndex].cantidad += quantity;
        return newCart;
      } else {
        return [
          ...prevCart,
          {
            cart_id: Date.now().toString() + Math.random().toString(),
            articulo_id: item.id,
            nombre: item.nombre,
            cantidad: quantity,
            precio_unitario: price
          }
        ];
      }
    });

    setSuccessMsg(`¡${quantity}x ${item.nombre} agregado al carrito!`);
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handleUpdateCartQty = (cartId: string, newQty: number) => {
    if (newQty <= 0) return;
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.cart_id === cartId ? { ...item, cantidad: newQty } : item
      )
    );
  };

  const handleRemoveFromCart = (cartId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setCart((prevCart) => prevCart.filter((item) => item.cart_id !== cartId));
  };

  // Calculations for Costa Rican colon (₡) and 13% IVA
  const subtotal = cart.reduce((sum, item) => sum + (item.precio_unitario * item.cantidad), 0);
  const impuesto = subtotal * 0.13;
  
  // Real-time Shipping Cost Express calculations for Costa Rica con IVA Incluido
  let costoEnvio = 0;
  if (tipoEntrega === 'Express') {
    costoEnvio = enGAM ? 5000 : 7000; // Tarifa base GAM o fuera de GAM
    const montoParaBeneficio = subtotal + impuesto;
    if (enGAM && montoParaBeneficio >= 100000) {
      costoEnvio = 0;
    } else if (!enGAM && montoParaBeneficio >= 150000) {
      costoEnvio = 0;
    }
  }

  const total = subtotal + impuesto + costoEnvio;

  // Format currency helpers
  const formatCRC = (val: number) => {
    return `₡${val.toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatCRCWithIva = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val) : val;
    const rounded = Math.round(num || 0);
    const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `₡${formatted} con IVA`;
  };

  // Open simulated checkout payment form
  const handleOpenCheckout = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!user) {
      showSecurityAlert();
      return;
    }

    if (cart.length === 0) {
      setErrorMsg('El carrito está vacío');
      return;
    }

    if (!telefonoContacto.trim()) {
      setErrorMsg("Por favor, ingrese un número de teléfono de contacto.");
      showAlert("Campos requeridos", "Por favor, ingrese un número de teléfono de contacto.");
      return;
    }

    if (tipoEntrega.toLowerCase() === 'express' && !direccionEnvio.trim()) {
      setErrorMsg("Ha seleccionado envío Express. Por favor, especifique la dirección completa de entrega.");
      showAlert("Dirección requerida", "Ha seleccionado envío Express. Por favor, especifique la dirección completa de entrega.");
      return;
    }

    setIsPaymentModalOpen(true);
  };

  // Confirm Purchase (POST to backend)
  const handleConfirmPurchase = async () => {
    setErrorMsg(null);
    
    // Simple simulated payment validations
    if (paymentMethod === 'card') {
      if (!cardNumber.trim() || !cardExpiry.trim() || !cardCvv.trim()) {
        showAlert("Campos faltantes", "Por favor ingrese todos los datos de su tarjeta");
        return;
      }
    } else {
      if (!paypalEmail.trim()) {
        showAlert("Campos faltantes", "Por favor ingrese su correo electrónico de PayPal");
        return;
      }
    }

    setIsSubmitting(true);
    setIsPaymentModalOpen(false); // Close payment modal to show transaction alert
    try {
      const itemsPayload = cart.map((item) => ({
        articulo_id: item.articulo_id,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario
      }));

      // Post to creating client order endpoint
      const response = await apiCall<any>('/inventario/crear-pedido', 'POST', {
        cliente_id: user?.id,
        productos: itemsPayload,
        tipo_entrega: tipoEntrega === 'Express' ? 'express' : 'sucursal',
        telefono_contacto: telefonoContacto.trim(),
        direccion_envio: tipoEntrega === 'Express' ? `${provincia}, ${direccionEnvio.trim()}` : null,
        enGAM: enGAM
      });

      if (response.success) {
        showAlert(
          "🎉 Compra Procesada",
          tipoEntrega === 'Express' 
            ? `Pago simulado procesado con éxito.\nSu pedido con ID #${response.pedido_id} ha sido registrado para envío express.`
            : `Pago simulado procesado con éxito.\nSu pedido con ID #${response.pedido_id} está listo para ser alistado en la sucursal.`,
          [{ text: "Excelente" }]
        );

        setSuccessMsg(response.message || '¡Compra realizada con éxito!');
        setCart([]);
        setTelefonoContacto('');
        setDireccionEnvio('');
        setTipoEntrega('Retiro en Lugar');
        setEnGAM(false);
        setCardNumber('');
        setCardExpiry('');
        setCardCvv('');
        setPaypalEmail('');
      } else {
        setErrorMsg(response.message || 'Error al procesar la compra');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión al servidor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const styles = getStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {user ? 'Catálogo de Compras' : 'Catálogo Público'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ThemeToggle />
          {user ? (
            <TouchableOpacity style={styles.logoutButton} onPress={logout} activeOpacity={0.7}>
              <Text style={styles.logoutButtonText}>Salir</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.logoutButton, { backgroundColor: colors.primary + '20', borderColor: colors.primary + '50' }]} 
              onPress={onNavigateToLogin} 
              activeOpacity={0.7}
            >
              <Text style={[styles.logoutButtonText, { color: colors.primary }]}>Ingresar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          {user ? (
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
          ) : (
            <View style={styles.profileCard}>
              <View style={styles.profileDetails}>
                <Text style={styles.welcomeText}>Modo de Vista Pública</Text>
                <Text style={styles.userName}>Usuario Invitado</Text>
                <Text style={styles.userEmail}>Inicie sesión para realizar compras en el WMS</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.warning + '20', borderColor: colors.warning + '50' }]}>
                <Text style={[styles.badgeText, { color: colors.warning }]}>Invitado</Text>
              </View>
            </View>
          )}

          {/* Product Catalog Grid Card */}
          <View style={styles.catalogCard}>
            <Text style={styles.catalogTitle}>Catálogo de Productos</Text>
            <Text style={styles.catalogSubtitle}>
              Seleccione una herramienta para ver detalles y agregar al carrito.
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
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={styles.loaderText}>Cargando catálogo...</Text>
              </View>
            ) : (
              <View style={styles.gridContainer}>
                {catalogList.map((item) => (
                  <TouchableOpacity 
                    key={item.id} 
                    style={styles.productCard}
                    onPress={() => {
                      setSelectedArticleForDetail(item);
                      setDetailQuantity(1);
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    activeOpacity={0.9}
                  >
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
                      <View style={styles.detailsIndicator}>
                        <Text style={styles.detailsIndicatorText}>Ver detalles</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
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
                      <Text style={styles.cartItemPrice}>Unitario: {formatCRC(item.precio_unitario)}</Text>
                      <Text style={styles.cartItemSubtotal}>Subtotal: {formatCRC(item.precio_unitario * item.cantidad)}</Text>
                      
                      {/* Quantity adjuster inside cart */}
                      <View style={styles.cartQtyRow}>
                        <TouchableOpacity 
                          style={styles.qtyChangeBtn}
                          onPress={() => handleUpdateCartQty(item.cart_id, item.cantidad - 1)}
                          activeOpacity={0.6}
                        >
                          <Text style={styles.qtyChangeBtnText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.cartQtyText}>{item.cantidad}</Text>
                        <TouchableOpacity 
                          style={styles.qtyChangeBtn}
                          onPress={() => handleUpdateCartQty(item.cart_id, item.cantidad + 1)}
                          activeOpacity={0.6}
                        >
                          <Text style={styles.qtyChangeBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
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
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="phone-pad"
                    value={telefonoContacto}
                    onChangeText={(text) => {
                      setTelefonoContacto(text);
                      setErrorMsg(null);
                    }}
                    editable={!isSubmitting}
                  />
                </View>

                {/* Delivery Method Selector */}
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

                {/* Dynamic Shipping Address & GAM Selector */}
                {tipoEntrega === 'Express' && (
                  <View style={{ gap: 16 }}>
                    {/* GAM Toggle Selector */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>¿Ubicación de entrega dentro del GAM (Gran Área Metropolitana)?</Text>
                      <View style={styles.gamSelectorRow}>
                        <TouchableOpacity
                          style={[styles.gamBtn, enGAM && styles.gamBtnSelected]}
                          onPress={() => {
                            setEnGAM(true);
                            setProvincia('San José'); // Reset to first GAM province
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.gamBtnText, enGAM && styles.gamBtnTextSelected]}>Sí (GAM)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.gamBtn, !enGAM && styles.gamBtnSelected]}
                          onPress={() => {
                            setEnGAM(false);
                            setProvincia('Puntarenas'); // Reset to first non-GAM province
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.gamBtnText, !enGAM && styles.gamBtnTextSelected]}>No (Fuera del GAM)</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.gamHelpText}>
                        * GAM (₡5 000): gratis si la compra total con IVA es de ₡100 000 o más. Fuera del GAM (₡7 000): gratis si la compra total con IVA es de ₡150 000 o más.
                      </Text>
                    </View>

                    {/* Province Selector Dropdown */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Provincia de Entrega</Text>
                      <TouchableOpacity
                        style={styles.dropdownSelector}
                        onPress={() => {
                          setIsProvinceDropdownOpen(true);
                          setErrorMsg(null);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.dropdownTextSelected}>
                          {provincia}
                        </Text>
                        <Text style={styles.dropdownArrow}>▼</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Shipping Address */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>Dirección de Envío (Obligatorio)</Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Provincia, Cantón, Distrito y dirección exacta..."
                        placeholderTextColor={colors.textSecondary}
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
                  {tipoEntrega === 'Express' && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Envío Express:</Text>
                      <Text style={[styles.summaryValue, costoEnvio === 0 && { color: colors.success, fontWeight: 'bold' }]}>
                        {costoEnvio === 0 ? 'Gratis' : formatCRC(costoEnvio)}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.summaryRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>TOTAL A PAGAR:</Text>
                    <Text style={styles.totalValue}>{formatCRC(total)}</Text>
                  </View>
                </View>

                {errorMsg && (
                  <View style={[styles.errorContainer, { marginBottom: 12, marginTop: 12 }]}>
                    <Text style={styles.errorText}>{errorMsg}</Text>
                  </View>
                )}

                {/* Place Order Trigger */}
                <TouchableOpacity
                  style={[styles.button, isSubmitting && styles.buttonDisabled]}
                  onPress={handleOpenCheckout}
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

      {/* 1. ARTICLE DETAIL MODAL */}
      {selectedArticleForDetail && (
        <Modal
          visible={selectedArticleForDetail !== null}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setSelectedArticleForDetail(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.detailModalContent}>
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                {/* Close Badge */}
                <TouchableOpacity 
                  style={styles.closeDetailBadge}
                  onPress={() => setSelectedArticleForDetail(null)}
                >
                  <Text style={styles.closeDetailBadgeText}>✕</Text>
                </TouchableOpacity>

                <Image 
                  source={{ uri: selectedArticleForDetail.imagen_url }} 
                  style={styles.detailModalImage}
                  resizeMode="cover"
                />
                
                <Text style={styles.detailModalName}>{selectedArticleForDetail.nombre}</Text>
                
                <View style={styles.detailPriceBlock}>
                  <Text style={styles.detailPriceIva}>
                    {formatCRCWithIva(selectedArticleForDetail.precio_con_iva)}
                  </Text>
                  <Text style={styles.detailPriceBase}>
                    Precio Base: {formatCRC(parseFloat(selectedArticleForDetail.precio_base))}
                  </Text>
                </View>

                <View style={styles.detailsDivider} />
                
                <Text style={styles.detailSectionTitle}>Especificaciones del Producto</Text>
                <Text style={styles.detailDescription}>
                  Herramienta profesional de alta calidad y rendimiento para trabajos de construcción y mantenimiento. Estructura robusta diseñada para cumplir con las normas de seguridad del WMS.
                </Text>

                <View style={styles.detailsDivider} />

                {/* Quantity selector */}
                <Text style={styles.detailSectionTitle}>Cantidad a solicitar</Text>
                <View style={styles.detailQtySelectorRow}>
                  <TouchableOpacity 
                    style={styles.detailQtyBtn}
                    onPress={() => setDetailQuantity(q => Math.max(1, q - 1))}
                  >
                    <Text style={styles.detailQtyBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.detailQtyText}>{detailQuantity}</Text>
                  <TouchableOpacity 
                    style={styles.detailQtyBtn}
                    onPress={() => setDetailQuantity(q => q + 1)}
                  >
                    <Text style={styles.detailQtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                {/* Add Action inside modal */}
                <TouchableOpacity
                  style={styles.detailAddBtn}
                  onPress={() => {
                    handleAddQuantityToCart(selectedArticleForDetail, detailQuantity);
                    setSelectedArticleForDetail(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.detailAddBtnText}>
                    Agregar al Carrito ({formatCRC((parseFloat(selectedArticleForDetail.precio_base) || 0) * detailQuantity)})
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* 2. DELIVERY METHOD DROPDOWN OVERLAY */}
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

      {/* 4. PROVINCE DROPDOWN OVERLAY */}
      <Modal
        visible={isProvinceDropdownOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsProvinceDropdownOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsProvinceDropdownOpen(false)}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={styles.modalContent} {...{ onClick: (e: any) => e.stopPropagation() }}>
              <Text style={styles.modalTitle}>Seleccionar Provincia</Text>
              
              {(enGAM 
                ? ['San José', 'Alajuela', 'Cartago', 'Heredia']
                : ['Puntarenas', 'Guanacaste', 'Limón']
              ).map((prov) => (
                <TouchableOpacity
                  key={prov}
                  style={[styles.modalItem, provincia === prov && styles.modalItemActive]}
                  onPress={() => {
                    setProvincia(prov);
                    setIsProvinceDropdownOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalItemText, provincia === prov && styles.modalItemTextActive]}>
                    {prov}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setIsProvinceDropdownOpen(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.closeModalButtonText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* 3. SIMULATED PAYMENT MODAL */}
      <Modal
        visible={isPaymentModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsPaymentModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsPaymentModalOpen(false)}
        >
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.modalContent, { maxHeight: '90%' }]} {...{ onClick: (e: any) => e.stopPropagation() }}>
              <Text style={styles.modalTitle}>Simulador de Pago Seguro</Text>
              <Text style={styles.paymentTotalText}>Total a debitar: {formatCRC(total)}</Text>
              
              {/* Payment Tab Selectors */}
              <View style={styles.paymentTabRow}>
                <TouchableOpacity
                  style={[styles.paymentTab, paymentMethod === 'card' && styles.paymentTabSelected]}
                  onPress={() => setPaymentMethod('card')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.paymentTabText, paymentMethod === 'card' && styles.paymentTabTextSelected]}>
                    Tarjeta Crédito/Débito
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.paymentTab, paymentMethod === 'paypal' && styles.paymentTabSelected]}
                  onPress={() => setPaymentMethod('paypal')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.paymentTabText, paymentMethod === 'paypal' && styles.paymentTabTextSelected]}>
                    PayPal
                  </Text>
                </TouchableOpacity>
              </View>

              {paymentMethod === 'card' ? (
                /* Card Input fields */
                <View style={{ gap: 14 }}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Número de Tarjeta (Simulado)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="4111 2222 3333 4444"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      maxLength={19}
                      value={cardNumber}
                      onChangeText={setCardNumber}
                    />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>Expiración</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="MM/YY"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="numeric"
                        maxLength={5}
                        value={cardExpiry}
                        onChangeText={setCardExpiry}
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={styles.label}>CVV</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="123"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="numeric"
                        secureTextEntry={true}
                        maxLength={4}
                        value={cardCvv}
                        onChangeText={setCardCvv}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                /* PayPal Input fields */
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Correo de Cuenta PayPal</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="usuario@correo.com"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={paypalEmail}
                    onChangeText={setPaypalEmail}
                  />
                </View>
              )}

              {/* Action Buttons */}
              <View style={{ gap: 10, marginTop: 10 }}>
                <TouchableOpacity
                  style={styles.payConfirmButton}
                  onPress={handleConfirmPurchase}
                  activeOpacity={0.8}
                >
                  <Text style={styles.payConfirmButtonText}>
                    Confirmar Pago y Compra
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeModalButton}
                  onPress={() => setIsPaymentModalOpen(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.closeModalButtonText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: colors.danger + '20',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger + '40',
    marginLeft: 10,
  },
  logoutButtonText: {
    color: colors.danger,
    fontWeight: 'bold',
    fontSize: 13,
  },
  scrollContainer: {
    padding: 20,
    gap: 20,
  },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
  },
  profileDetails: {
    flex: 1,
  },
  welcomeText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  userName: {
    color: colors.text,
    fontSize: 19,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  userEmail: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  badge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  catalogCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  catalogTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  catalogSubtitle: {
    color: colors.textSecondary,
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
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 8,
  },
  productImage: {
    width: '100%',
    height: 110,
    backgroundColor: colors.card,
  },
  productInfo: {
    padding: 10,
    gap: 4,
  },
  productName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: 'bold',
    height: 34,
  },
  productPriceConIva: {
    color: colors.success,
    fontSize: 12,
    fontWeight: 'bold',
  },
  productPriceBase: {
    color: colors.textSecondary,
    fontSize: 10,
  },
  detailsIndicator: {
    backgroundColor: colors.primary + '15',
    borderRadius: 6,
    paddingVertical: 5,
    alignItems: 'center',
    marginTop: 4,
  },
  detailsIndicatorText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  cartCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  cartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  cartTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  cartBadge: {
    backgroundColor: colors.primary,
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
    color: colors.textSecondary,
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
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cartItemInfo: {
    flex: 1,
    gap: 3,
  },
  cartItemName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  cartItemPrice: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  cartItemSubtotal: {
    color: colors.success,
    fontSize: 13,
    fontWeight: 'bold',
  },
  cartQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  qtyChangeBtn: {
    backgroundColor: colors.primary + '15',
    width: 26,
    height: 26,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  qtyChangeBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  cartQtyText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
    minWidth: 16,
    textAlign: 'center',
  },
  removeBtn: {
    backgroundColor: colors.danger + '15',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger + '30',
  },
  removeBtnText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailsDivider: {
    height: 1,
    borderColor: colors.border,
    borderWidth: 0.5,
    marginVertical: 10,
  },
  sectionTitle: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  label: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.inputBg,
    color: colors.inputText,
    borderWidth: 1,
    borderColor: colors.inputBorder,
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
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownTextSelected: {
    color: colors.inputText,
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownArrow: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  gamSelectorRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  gamBtn: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  gamBtnSelected: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  gamBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  gamBtnTextSelected: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  gamHelpText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 16,
  },
  summaryContainer: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    marginTop: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 13,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  totalValue: {
    color: colors.success,
    fontSize: 16,
    fontWeight: 'bold',
  },
  button: {
    backgroundColor: colors.success,
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
    color: colors.textSecondary,
    fontSize: 14,
  },
  successContainer: {
    backgroundColor: colors.success + '15',
    borderWidth: 1,
    borderColor: colors.success + '30',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  successText: {
    color: colors.success,
    fontSize: 13,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: colors.danger + '15',
    borderWidth: 1,
    borderColor: colors.danger + '30',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },
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
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 16,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalItemActive: {
    backgroundColor: colors.primary + '15',
  },
  modalItemText: {
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
  },
  modalItemTextActive: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  closeModalButton: {
    backgroundColor: colors.danger + '15',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.danger + '30',
  },
  closeModalButtonText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  // DETAIL MODAL STYLES
  detailModalContent: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
  },
  closeDetailBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeDetailBadgeText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  detailModalImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: colors.background,
    marginBottom: 16,
  },
  detailModalName: {
    color: colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  detailPriceBlock: {
    gap: 4,
    marginBottom: 12,
  },
  detailPriceIva: {
    color: colors.success,
    fontSize: 18,
    fontWeight: 'bold',
  },
  detailPriceBase: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  detailSectionTitle: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 6,
  },
  detailDescription: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  detailQtySelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 4,
    marginBottom: 14,
  },
  detailQtyBtn: {
    backgroundColor: colors.primary,
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailQtyBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  detailQtyText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: 'bold',
    minWidth: 24,
    textAlign: 'center',
  },
  detailAddBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  detailAddBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  
  // PAYMENT SIMULATOR STYLES
  paymentTotalText: {
    color: colors.success,
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  paymentTabRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  paymentTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  paymentTabSelected: {
    backgroundColor: colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentTabText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  paymentTabTextSelected: {
    color: colors.primary,
    fontWeight: 'bold',
  },
  payConfirmButton: {
    backgroundColor: colors.success,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.success,
  },
  payConfirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
