import { Platform } from 'react-native';

// Use 10.0.2.2 for Android Emulator, localhost for iOS/Web, or set your machine's IP address
export const BASE_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:3000/api/v1'
  : 'http://localhost:3000/api/v1';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export async function apiCall<T>(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: any): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Error en la solicitud: ${response.status}`);
    }

    // PARCHE DE SEGURIDAD: Si la respuesta HTTP fue exitosa (200-299),
    // garantizamos que 'success' sea true aunque el backend no lo envíe explicitamente.
    return {
      success: data.success !== undefined ? data.success : true,
      ...data
    } as ApiResponse<T>;

  } catch (error: any) {
    console.error(`Error en API Call a ${url}:`, error.message);
    throw error;
  }
}