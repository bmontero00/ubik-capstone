// Formatea mientras el usuario escribe: "123456785" -> "12.345.678-5"
export function formatRut(value: string): string {
  const clean = value.replace(/[^0-9kK]/g, '').toUpperCase().slice(0, 9);
  if (clean.length <= 1) return clean;
  const body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${body}-${clean.slice(-1)}`;
}

// Valida el dígito verificador (módulo 11), igual que el backend
export function isValidRut(value: string): boolean {
  const clean = value.replace(/[^0-9kK]/g, '').toUpperCase();
  const match = /^(\d{7,8})([\dK])$/.exec(clean);
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
