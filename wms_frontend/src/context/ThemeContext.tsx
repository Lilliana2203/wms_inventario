import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'dark' | 'light';

export const darkColors = {
  background: '#0B132B',
  card: '#1C2541',
  text: '#FFFFFF',
  textSecondary: '#5C6B73',
  primary: '#3A86C8',
  border: '#22333B',
  success: '#2A9D8F',
  danger: '#FF3366',
  warning: '#FF9F1C',
  info: '#8338EC',
  inputBg: '#0B132B',
  inputBorder: '#22333B',
  inputText: '#FFFFFF',
};

export const lightColors = {
  background: '#F4F5F7',
  card: '#FFFFFF',
  text: '#1C2541',
  textSecondary: '#64748B',
  primary: '#3A86C8',
  border: '#E2E8F0',
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#6366F1',
  inputBg: '#EDF2F7',
  inputBorder: '#CBD5E1',
  inputText: '#1C2541',
};

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  isDark: boolean;
  colors: typeof darkColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<ThemeMode>('dark');

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedTheme = await AsyncStorage.getItem('wms_theme');
        if (storedTheme) {
          setTheme(storedTheme as ThemeMode);
        }
      } catch (e: any) {
        console.error('Error loading theme:', e.message);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    try {
      await AsyncStorage.setItem('wms_theme', nextTheme);
    } catch (e: any) {
      console.error('Error saving theme:', e.message);
    }
  };

  const isDark = theme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe ser utilizado dentro de un ThemeProvider');
  }
  return context;
};

export const getThemeOverrides = (colors: any) => ({
  container: { backgroundColor: colors.background },
  loadingContainer: { backgroundColor: colors.background },
  header: { backgroundColor: colors.card, borderBottomColor: colors.border },
  headerTitle: { color: colors.text },
  tabContainer: { backgroundColor: colors.card, borderColor: colors.border },
  tabTextActive: { color: colors.text },
  tabText: { color: colors.textSecondary },
  profileCard: { backgroundColor: colors.card, borderColor: colors.border },
  userName: { color: colors.text },
  userEmail: { color: colors.textSecondary },
  requestsContainer: { backgroundColor: colors.card, borderColor: colors.border },
  requestCard: { backgroundColor: colors.background, borderColor: colors.border },
  requestArtName: { color: colors.text },
  requestDetails: { color: colors.textSecondary },
  rackContainer: { backgroundColor: colors.card, borderColor: colors.border },
  rackTitle: { color: colors.text },
  floorCard: { backgroundColor: colors.background, borderColor: colors.border },
  floorTypeText: { color: colors.textSecondary },
  stockText: { color: colors.text },
  detailRow: { borderTopColor: colors.border },
  detailLabel: { color: colors.textSecondary },
  detailValue: { color: colors.text },
  modalContent: { backgroundColor: colors.card, borderColor: colors.border },
  modalTitle: { color: colors.text },
  input: { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.inputText },
  // Compras specific
  catalogCard: { backgroundColor: colors.card, borderColor: colors.border },
  catalogTitle: { color: colors.text },
  catalogSubtitle: { color: colors.textSecondary },
  productCard: { backgroundColor: colors.background, borderColor: colors.border },
  productName: { color: colors.text },
  productPriceBase: { color: colors.textSecondary },
  cartCard: { backgroundColor: colors.card, borderColor: colors.border },
  cartTitle: { color: colors.text },
  emptyCartText: { color: colors.textSecondary },
  cartItem: { backgroundColor: colors.background, borderColor: colors.border },
  cartItemName: { color: colors.text },
  cartItemPrice: { color: colors.textSecondary },
  summaryContainer: { backgroundColor: colors.background, borderColor: colors.border },
  summaryLabel: { color: colors.textSecondary },
  summaryValue: { color: colors.text },
  // Mapa specific
  tasksContainer: { backgroundColor: colors.card, borderColor: colors.border },
  taskCard: { backgroundColor: colors.background, borderColor: colors.border },
  taskArtName: { color: colors.text },
  taskDetails: { color: colors.textSecondary },
  // Admin specific
  statsCard: { backgroundColor: colors.card, borderColor: colors.border },
  statsTitle: { color: colors.textSecondary },
  statsValue: { color: colors.text },
  tableHeader: { backgroundColor: colors.background, borderBottomColor: colors.border },
  tableRow: { borderBottomColor: colors.border },
  tableCell: { color: colors.text },
  emptyContainer: { backgroundColor: colors.card, borderColor: colors.border },
  emptyText: { color: colors.textSecondary },
});
