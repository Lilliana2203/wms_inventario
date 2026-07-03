import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ComprasScreen from './src/screens/ComprasScreen';
import HistorialClienteScreen from './src/screens/HistorialClienteScreen';
import MapaScreen from './src/screens/MapaScreen';
import AjustesScreen from './src/screens/AjustesScreen';
import DespachoPedidosScreen from './src/screens/DespachoPedidosScreen';
import AdminScreen from './src/screens/AdminScreen';

function ClienteContainer() {
  const [activeTab, setActiveTab] = useState<'catalogo' | 'historial'>('catalogo');

  return (
    <View style={styles.clientContainer}>
      <View style={{ flex: 1 }}>
        {activeTab === 'catalogo' ? (
          <ComprasScreen />
        ) : (
          <HistorialClienteScreen />
        )}
      </View>
      
      {/* Bottom Navigation Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'catalogo' && styles.activeTabItem]} 
          onPress={() => setActiveTab('catalogo')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'catalogo' && styles.activeTabText]}>🛒 Catálogo</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'historial' && styles.activeTabItem]} 
          onPress={() => setActiveTab('historial')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'historial' && styles.activeTabText]}>📋 Mis Pedidos</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MainApp() {
  const { user, isLoading } = useAuth();
  const [showRegister, setShowRegister] = useState(false);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3A86C8" />
      </View>
    );
  }

  if (!user) {
    if (showRegister) {
      return <RegisterScreen onNavigateToLogin={() => setShowRegister(false)} />;
    }
    return <LoginScreen onNavigateToRegister={() => setShowRegister(true)} />;
  }

  // Routing Logic based on 'rol_id':
  // - Rol 1: Compras (Cliente)
  // - Rol 2: Despacho de Pedidos (Alistador)
  // - Rol 3: Mapa de Racks (Montacargas)
  // - Rol 4: Ajustes (Inventario)
  // - Rol 5: Administrador
  switch (user.rol_id) {
    case 1:
      return <ClienteContainer />;
    case 2:
      return <DespachoPedidosScreen />;
    case 3:
      return <MapaScreen />;
    case 4:
      return <AjustesScreen />;
    case 5:
      return <AdminScreen />;
    default:
      return <LoginScreen onNavigateToRegister={() => setShowRegister(true)} />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0B132B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientContainer: {
    flex: 1,
    backgroundColor: '#0B132B',
  },
  tabBar: {
    height: 60,
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#22333B',
    backgroundColor: '#1C2541',
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTabItem: {
    borderTopWidth: 3,
    borderTopColor: '#3A86C8',
    backgroundColor: '#1C2541',
  },
  tabText: {
    color: '#5C6B73',
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
