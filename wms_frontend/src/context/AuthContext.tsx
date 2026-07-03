import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiCall } from '../services/api';

export interface User {
  id: number;
  nombre: string;
  email: string;
  rol_id: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize and load stored user session
  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('wms_user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (e: any) {
        console.error('Error al cargar la sesión desde AsyncStorage:', e.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiCall<{ user: User }>('/auth/login', 'POST', {
        email: email.trim().toLowerCase(),
        password
      });

      if (response.success && response.data && response.data.user) {
        const loggedUser = response.data.user;
        setUser(loggedUser);
        await AsyncStorage.setItem('wms_user', JSON.stringify(loggedUser));
      } else {
        throw new Error(response.message || 'Error desconocido al iniciar sesión');
      }
    } catch (e: any) {
      setError(e.message || 'Error de conexión con el servidor');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      setUser(null);
      await AsyncStorage.removeItem('wms_user');
    } catch (e: any) {
      console.error('Error al remover sesión:', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        logout,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
