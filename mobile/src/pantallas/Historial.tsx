import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Escaneo, EventoApp, Resultado, fetchHistorial } from '../api';
import { c, s } from '../tema';

const hora = (f: string) => new Date(f).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const COLOR: Record<Resultado, string> = {
  VALIDA: c.esmeraldaClaro, YA_USADA: c.ambar, TIPO_NO_PERMITIDO: c.ambar,
  OTRO_EVENTO: '#f87171', NO_PAGADA: '#f87171', INEXISTENTE: '#f87171', EVENTO_CANCELADO: '#f87171',
};
const ETIQUETA: Record<Resultado, string> = {
  VALIDA: 'Válida', YA_USADA: 'Ya usada', TIPO_NO_PERMITIDO: 'Otro acceso', OTRO_EVENTO: 'Otro evento',
  NO_PAGADA: 'No pagada', INEXISTENTE: 'No existe', EVENTO_CANCELADO: 'Cancelado',
};

// Últimos escaneos del evento en todas las puertas (válidos y rechazados)
export default function Historial({ evento, onVolver }: { evento: EventoApp; onVolver: () => void }) {
  const [filas, setFilas] = useState<Escaneo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recargando, setRecargando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setFilas(await fetchHistorial(evento.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el historial');
    }
  }, [evento.id]);
  useEffect(() => { cargar(); }, [cargar]);

  return (
    <SafeAreaView style={s.pantalla}>
      <View style={[s.contenido, { paddingBottom: 4, paddingTop: 12 }]}>
        <Pressable onPress={onVolver} style={[s.botonSecundario, { alignSelf: 'flex-start' }]} accessibilityRole="button">
          <Text style={s.botonSecundarioTexto}>‹ Validar</Text>
        </Pressable>
        <Text style={s.titulo}>Historial</Text>
        <Text style={s.subtitulo} numberOfLines={1}>{evento.title}</Text>
        {error && <Text style={s.error}>{error}</Text>}
      </View>
      {!filas && !error ? (
        <ActivityIndicator color={c.esmeraldaClaro} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filas ?? []}
          keyExtractor={(f) => f.id}
          contentContainerStyle={{ padding: 20, gap: 10 }}
          refreshControl={<RefreshControl refreshing={recargando} tintColor={c.esmeraldaClaro} onRefresh={async () => { setRecargando(true); await cargar(); setRecargando(false); }} />}
          ListEmptyComponent={!error ? <Text style={[s.subtitulo, { textAlign: 'center', marginTop: 30 }]}>Aún no hay escaneos en este evento.</Text> : undefined}
          renderItem={({ item: f }) => (
            <View style={[s.tarjeta, st.fila]}>
              <View style={[st.punto, { backgroundColor: COLOR[f.resultado] }]} />
              <View style={{ flex: 1 }}>
                <Text style={st.nombre} numberOfLines={1}>{f.asistente ?? f.codigo}</Text>
                <Text style={st.dato} numberOfLines={1}>{f.tipo ? `${f.tipo} · ` : ''}{f.validadoPor ?? ''}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[st.estado, { color: COLOR[f.resultado] }]}>{ETIQUETA[f.resultado]}</Text>
                <Text style={st.dato}>{hora(f.fecha)}</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  punto: { width: 10, height: 10, borderRadius: 5 },
  nombre: { color: c.texto, fontSize: 15, fontWeight: '700' },
  dato: { color: c.suave, fontSize: 12, marginTop: 2 },
  estado: { fontSize: 13, fontWeight: '800' },
});
