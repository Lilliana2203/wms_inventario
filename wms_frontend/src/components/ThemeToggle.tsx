import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <TouchableOpacity 
      style={styles.toggleBtn} 
      onPress={toggleTheme} 
      activeOpacity={0.7}
    >
      <Text style={styles.toggleBtnText}>
        {theme === 'dark' ? '☀️ Claro' : '🌙 Oscuro'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  toggleBtn: {
    backgroundColor: '#3A86C820',
    borderColor: '#3A86C860',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleBtnText: {
    color: '#3A86C8',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
