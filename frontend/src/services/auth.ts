export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export type UserRole = 'ATTENDEE' | 'ORGANIZER' | 'ADMIN';
export type OrganizerStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizerStatus: OrganizerStatus | null;
  rejectionReason: string | null;
  organizationName: string | null;
}

export interface AuthResponse {
  message: string;
  user: AuthUser;
  accessToken: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  accountType: 'ATTENDEE' | 'ORGANIZER';
  // Solo organizadores
  rut?: string;
  phone?: string;
  organizationName?: string;
  eventDescription?: string;
  socialUrl?: string;
  acceptsTerms?: boolean;
}

const TOKEN_KEY = 'ubik_token';
const USER_KEY = 'ubik_user';

// NestJS devuelve los errores de validación como arreglo de mensajes
async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(data.message) ? data.message[0] : data.message;
    throw new Error(message || fallback);
  }
  return data;
}

export async function registerUser(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseResponse(response, 'Error al registrar usuario');
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return parseResponse(response, 'Credenciales inválidas');
}

// fetch con el token de la sesión actual
export function authFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  return parseResponse(await authFetch('/auth/me'), 'No se pudo recuperar la sesión');
}

// --- Sesión en localStorage ---

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveSession(data: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, data.accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

export function updateStoredUser(user: AuthUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw || !getToken()) return null;
    const parsed = JSON.parse(raw);
    return parsed.user ?? parsed;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Un organizador solo puede publicar eventos si fue aprobado
export function canPublishEvents(user: AuthUser | null): boolean {
  if (!user) return false;
  return user.role === 'ADMIN' || (user.role === 'ORGANIZER' && user.organizerStatus === 'APPROVED');
}
