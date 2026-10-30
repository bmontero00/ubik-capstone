// Utilidades para el RUT chileno (formato 12.345.678-5)

// Deja el RUT como "12345678-5" (sin puntos, DV en mayúscula)
export function normalizeRut(rut: string): string {
  const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return clean;
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}

// Valida el dígito verificador con el algoritmo módulo 11
export function isValidRut(rut: string): boolean {
  const normalized = normalizeRut(rut);
  const match = /^(\d{7,8})-([\dK])$/.exec(normalized);
  if (!match) return false;

  const [, body, dv] = match;
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const expected = 11 - (sum % 11);
  const expectedDv = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected);
  return dv === expectedDv;
}
