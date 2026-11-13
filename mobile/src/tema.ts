import { StyleSheet } from 'react-native';

// Colores de UBIK (los mismos del sitio)
export const c = {
  fondo: '#0b1120',
  tarjeta: '#0f172a',
  borde: '#1e293b',
  bordeFuerte: '#334155',
  texto: '#f8fafc',
  suave: '#94a3b8',
  tenue: '#64748b',
  esmeralda: '#10b981',
  esmeraldaClaro: '#34d399',
  cian: '#22d3ee',
  indigo: '#6366f1',
  ambar: '#f59e0b',
  rojo: '#ef4444',
  cielo: '#38bdf8',
};

export const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: c.fondo },
  contenido: { padding: 20, gap: 16 },
  titulo: { color: c.texto, fontSize: 24, fontWeight: '800' },
  subtitulo: { color: c.suave, fontSize: 14 },
  etiqueta: { color: c.suave, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  tarjeta: { backgroundColor: c.tarjeta, borderColor: c.borde, borderWidth: 1, borderRadius: 18, padding: 16 },
  input: {
    backgroundColor: '#020617', borderColor: c.bordeFuerte, borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, color: c.texto, fontSize: 16,
  },
  boton: { backgroundColor: c.esmeralda, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  botonTexto: { color: '#022c22', fontSize: 16, fontWeight: '800' },
  botonSecundario: { backgroundColor: c.borde, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  botonSecundarioTexto: { color: c.texto, fontSize: 15, fontWeight: '700' },
  error: { color: '#fda4af', fontSize: 14 },
});
