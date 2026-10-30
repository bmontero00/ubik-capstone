// Celulares chilenos: +56 (fijo) + 9 dígitos que comienzan con 9 = 11 dígitos en total
export const PHONE_PREFIX = '+56';
const LOCAL_DIGITS = 9;

// Deja solo los 9 dígitos locales. Si pegan el número con el 56 adelante, se descarta.
function localDigits(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.length > LOCAL_DIGITS && digits.startsWith('56')) digits = digits.slice(2);
  return digits.slice(0, LOCAL_DIGITS);
}

// Formatea mientras se escribe la parte local: "912345678" -> "9 1234 5678"
export function formatLocalPhone(value: string): string {
  const d = localDigits(value);
  return [d.slice(0, 1), d.slice(1, 5), d.slice(5, 9)].filter(Boolean).join(' ');
}

export function isValidLocalPhone(value: string): boolean {
  return /^9\d{8}$/.test(localDigits(value));
}

// Número completo para enviar al backend: "+56 9 1234 5678"
export function toFullPhone(local: string): string {
  return `${PHONE_PREFIX} ${formatLocalPhone(local)}`;
}

// Para mostrar un número guardado ("+56912345678") como "+56 9 1234 5678"
export function formatPhoneDisplay(value: string): string {
  return localDigits(value).length === LOCAL_DIGITS ? toFullPhone(value) : value;
}
