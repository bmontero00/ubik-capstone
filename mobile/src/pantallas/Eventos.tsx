import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EventoApp, Sesion, fetchEventos } from '../api';
import { c, s } from '../tema';

const fecha = (f: string) => new Date(f).toLocaleString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

// Eventos de hoy y próximos del organizador (el equipo de acceso solo ve el evento de su acceso)
export default function Eventos({ sesion, onElegir, onSalir }: { sesion: Sesion; onElegir: (e: EventoApp) => void; onSalir: () => void }) {
  const [eventos, setEventos] = useState<EventoApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recargando, setRecargando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setError(null);
      setEventos(await fetchEventos());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los eventos');
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  return (
    <SafeAreaView style={s.pantalla}>
      <View style={[s.contenido, { paddingBottom: 8 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={s.etiqueta}>{sesion.tipo === 'organizador' ? 'Organizador' : 'Equipo de acceso'}</Text>
            <Text style={s.titulo} numberOfLines={1}>Hola, {sesion.nombre.split(' ')[0]}</Text>
          </View>
          <Pressable onPress={onSalir} style={s.botonSecundario} accessibilityRole="button">
            <Text style={s.botonSecundarioTexto}>Salir</Text>
          </Pressable>
        </View>
        <Text style={s.subtitulo}>Elige el evento para validar entradas.</Text>
        {error && <Text style={s.error}>{error}</Text>}
      </View>
      {!eventos && !error ? (
        <ActivityIndicator color={c.esmeraldaClaro} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={eventos ?? []}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 12 }}
          refreshControl={<RefreshControl refreshing={recargando} tintColor={c.esmeraldaClaro} onRefresh={async () => { setRecargando(true); await cargar(); setRecargando(false); }} />}
          ListEmptyComponent={!error ? <Text style={[s.subtitulo, { textAlign: 'center', marginTop: 30 }]}>No tienes eventos hoy ni próximos.</Text> : undefined}
          renderItem={({ item: e }) => {
            const pct = e.vendidas ? Math.round((e.ingresados / e.vendidas) * 100) : 0;
            return (
              <Pressable onPress={() => onElegir(e)} style={({ pressed }) => [s.tarjeta, pressed && { borderColor: c.esmeralda }]} accessibilityRole="button">
                <Text style={st.titulo}>{e.title}</Text>
                <Text style={st.dato}>{fecha(e.date)}</Text>
                <Text style={st.dato} numberOfLines={1}>{e.address}</Text>
                {e.status === 'POSTPONED' && <Text style={[st.dato, { color: c.cielo }]}>Evento postergado (las entradas valen para la nueva fecha)</Text>}
                {e.acceso && (
                  <Text style={[st.dato, { color: c.cian }]}>
                    {e.acceso.puerta ? `${e.acceso.puerta} · ` : ''}{e.acceso.todosLosTipos ? 'Todas las entradas' : `Solo ${e.acceso.tiposEntrada.map((t) => t.nombre).join(', ')}`}
                  </Text>
                )}
                <View style={st.barra}><View style={[st.relleno, { width: `${pct}%` }]} /></View>
                <Text style={st.contador}><Text style={{ color: c.texto, fontWeight: '800' }}>{e.ingresados}</Text> de {e.vendidas} ingresaron</Text>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  titulo: { color: c.texto, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  dato: { color: c.suave, fontSize: 13, marginTop: 2 },
  barra: { height: 6, borderRadius: 3, backgroundColor: c.borde, marginTop: 12, overflow: 'hidden' },
  relleno: { height: 6, borderRadius: 3, backgroundColor: c.esmeralda },
  contador: { color: c.suave, fontSize: 13, marginTop: 6 },
});
