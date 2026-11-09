// Límite de intentos por clave (correo, IP...) dentro de una ventana de tiempo. Vive en memoria:
// alcanza para una sola instancia del backend (con varias habría que llevarlo a la base o a Redis).
export class Limitador {
  private readonly registros = new Map<string, number[]>();

  constructor(
    private readonly maximo: number,
    private readonly ventanaMs: number,
  ) {}

  // Registra el intento y devuelve false si la clave ya superó el máximo en la ventana
  permitir(clave: string): boolean {
    const ahora = Date.now();
    const recientes = (this.registros.get(clave) ?? []).filter((t) => ahora - t < this.ventanaMs);
    if (recientes.length >= this.maximo) {
      this.registros.set(clave, recientes);
      return false;
    }
    recientes.push(ahora);
    this.registros.set(clave, recientes);
    // Limpieza ocasional para que el mapa no crezca sin control
    if (this.registros.size > 5000) {
      for (const [k, v] of this.registros) if (!v.some((t) => ahora - t < this.ventanaMs)) this.registros.delete(k);
    }
    return true;
  }
}
