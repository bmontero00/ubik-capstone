const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface AuthResponse {
  message: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  accessToken: string;
}

export async function registerUser(name: string, email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Error al registrar usuario');
  }
  return data;
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Credenciales inválidas');
  }
  return data;
}