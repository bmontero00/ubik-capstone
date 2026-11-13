import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { EventoApp, RespuestaValidacion, Resultado, Resumen, fetchResumen, validar } from '../api';
import Escaner from '../componentes/Escaner';
import { c, s } from '../tema';

const hora = (f: string) => new Date(f).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });

// Color y título de cada resultado: verde = pasa, ámbar = ya usada o de otro acceso, rojo = no pasa
const ESTILO: Record<Resultado, { color: string; titulo: string }> = {
  VALIDA: { color: '#059669', titulo: 'Puede ingresar' },
  YA_USADA: { color: '#d97706', titulo: 'Ya ingresó' },
  TIPO_NO_PERMITIDO: { color: '#d97706', titulo: 'Otro acceso' },
  OTRO_EVENTO: { color: '#dc2626', titulo: 'Otro evento' },
  NO_PAGADA: { color: '#dc2626', titulo: 'No pagada' },
  INEXISTENTE: { color: '#dc2626', titulo: 'No existe' },
  EVENTO_CANCELADO: { color: '#dc2626', titulo: 'Evento cancelado' },
};

// Validación en el acceso: cámara para el QR, campo para escribir el código, resultado a pantalla
// completa con vibración y el contador "ingresados / vendidas" (se actualiza cada pocos segundos,
// así se ven también los ingresos de las otras puertas).
export default function Validar({ evento, onVolver, onHistorial }: { evento: EventoApp; onVolver: () => void; onHistorial: () => void }) {
  const [resultado, setResultado] = useState<RespuestaValidacion | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [codigo, setCodigo] = useState('');
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cierre = useRef<ReturnType<typeof setTimeout> | null>(null);

  const actualizar = useCallback(() => { fetchResumen(evento.id).then(setResumen).catch(() => {}); }, [evento.id]);
  useEffect(() => {
    actualizar();
    const t = setInterval(actualizar, 5000);
    return () => { clearInterval(t); if (cierre.current) clearTimeout(cierre.current); };
  }, [actualizar]);

  const cerrarResultado = () => {
    if (cierre.current) clearTimeout(cierre.current);
    setResultado(null);
  };

  const enviar = async (valor: string) => {
    const limpio = valor.trim();
    if (!limpio || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await validar(evento.id, limpio);
      setResultado(r);
      setResumen((x) => (x ? { ...x, ...r.contador } : x));
      setCodigo('');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(
          r.valida ? Haptics.NotificationFeedbackType.Success
            : r.resultado === 'YA_USADA' || r.resultado === 'TIPO_NO_PERMITIDO' ? Haptics.NotificationFeedbackType.Warning
              : Haptics.NotificationFeedbackType.Error,
        ).catch(() => {});
      }
      // Una entrada válida se cierra sola para seguir escaneando; las demás esperan a que se toque
      if (r.valida) cierre.current = setTimeout(() => setResultado(null), 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo validar');
    } finally {
      setBusy(false);
    }
  };

  const total = resumen ?? { vendidas: evento.vendidas, ingresados: evento.ingresados, porIngresar: evento.vendidas - evento.ingresados };

  return (
    <SafeAreaView style={s.pantalla}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[s.contenido, { paddingTop: 12 }]} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={onVolver} style={s.botonSecundario} accessibilityRole="button" accessibilityLabel="Volver a mis eventos">
              <Text style={s.botonSecundarioTexto}>‹ Eventos</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onHistorial} style={s.botonSecundario} accessibilityRole="button">
              <Text style={s.botonSecundarioTexto}>Historial</Text>
            </Pressable>
          </View>

          <View>
            <Text style={s.titulo} numberOfLines={2}>{evento.title}</Text>
            {evento.acceso && (
              <Text style={[s.subtitulo, { color: c.cian, marginTop: 4 }]}>
                {evento.acceso.puerta ? `${evento.acceso.puerta} · ` : ''}{evento.acceso.todosLosTipos ? 'Todas las entradas' : `Solo ${evento.acceso.tiposEntrada.map((t) => t.nombre).join(', ')}`}
              </Text>
            )}
            {evento.edadMinima ? <Text style={[s.subtitulo, { color: '#fda4af', marginTop: 4 }]}>Evento +{evento.edadMinima}: pide la cédula si tienes dudas de la edad</Text> : null}
          </View>

          {/* Contador en vivo */}
          <View style={[s.tarjeta, st.contador]}>
            <View style={{ flex: 1 }}>
              <Text style={s.etiqueta}>Ingresaron</Text>
              <Text style={st.numero}>{total.ingresados}<Text style={st.de}> / {total.vendidas}</Text></Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.etiqueta}>Por ingresar</Text>
              <Text style={[st.numero, { color: c.suave }]}>{total.porIngresar}</Text>
            </View>
          </View>

          {manual ? (
            <View style={[s.tarjeta, { gap: 12 }]}>
              <Text style={s.etiqueta}>Código de la entrada</Text>
              <TextInput
                style={[s.input, st.codigo]}
                value={codigo}
                onChangeText={(t) => setCodigo(t.toUpperCase())}
                placeholder="Ej. JWH2FRWN9ZP8ZMSH"
                placeholderTextColor={c.tenue}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                onSubmitEditing={() => enviar(codigo)}
                accessibilityLabel="Código de la entrada"
              />
              <Pressable style={[s.boton, (busy || !codigo.trim()) && { opacity: 0.6 }]} disabled={busy || !codigo.trim()} onPress={() => enviar(codigo)}>
                {busy && <ActivityIndicator color="#022c22" />}
                <Text style={s.botonTexto}>Validar</Text>
              </Pressable>
              <Pressable style={s.botonSecundario} onPress={() => setManual(false)}>
                <Text style={s.botonSecundarioTexto}>Volver a la cámara</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <Escaner onCodigo={enviar} pausado={busy || !!resultado} alto={340} />
              <Pressable style={s.botonSecundario} onPress={() => setManual(true)}>
                <Text style={s.botonSecundarioTexto}>Escribir el código a mano</Text>
              </Pressable>
            </View>
          )}
          {busy && !manual && <ActivityIndicator color={c.esmeraldaClaro} />}
          {error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>

      {resultado && <ResultadoPantalla r={resultado} onCerrar={cerrarResultado} />}
    </SafeAreaView>
  );
}

function ResultadoPantalla({ r, onCerrar }: { r: RespuestaValidacion; onCerrar: () => void }) {
  const e = ESTILO[r.resultado];
  return (
    <Pressable style={[StyleSheet.absoluteFill, st.resultado, { backgroundColor: e.color }]} onPress={onCerrar} accessibilityRole="alert" accessibilityLabel={`${e.titulo}. ${r.mensaje}`}>
      <Text style={st.icono}>{r.valida ? '✓' : r.resultado === 'YA_USADA' || r.resultado === 'TIPO_NO_PERMITIDO' ? '!' : '✕'}</Text>
      <Text style={st.resultadoTitulo}>{e.titulo}</Text>
      <Text style={st.resultadoMensaje}>{r.mensaje}</Text>

      {r.asistente && (
        <View style={st.ficha}>
          <Text style={st.fichaNombre}>{r.asistente.nombre} {r.asistente.apellido}</Text>
          <Text style={st.fichaDato}>{r.asistente.tipo} · RUT {r.asistente.rut}</Text>
        </View>
      )}
      {r.estacionamiento && (
        <View style={st.ficha}>
          <Text style={st.fichaNombre}>Estacionamiento · {r.estacionamiento.vehiculos} {r.estacionamiento.vehiculos === 1 ? 'vehículo' : 'vehículos'}</Text>
          <Text style={st.fichaDato}>Compra {r.estacionamiento.compra}</Text>
        </View>
      )}
      {r.resultado === 'YA_USADA' && r.usadaEn && (
        <Text style={st.resultadoMensaje}>Ingresó a las {hora(r.usadaEn)}{r.validadaPor ? ` · validó ${r.validadaPor}` : ''}</Text>
      )}
      {r.valida && r.evento.edadMinima ? <Text style={st.resultadoMensaje}>Evento +{r.evento.edadMinima}: revisa la cédula si tienes dudas</Text> : null}

      <Text style={st.tocar}>{r.valida ? 'Sigue escaneando…' : 'Toca para continuar'}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  contador: { flexDirection: 'row', alignItems: 'flex-end' },
  numero: { color: c.texto, fontSize: 40, fontWeight: '900', fontVariant: ['tabular-nums'] },
  de: { color: c.suave, fontSize: 22, fontWeight: '700' },
  codigo: { fontSize: 20, letterSpacing: 2, textAlign: 'center', fontWeight: '800', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },
  resultado: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  icono: { color: '#ffffff', fontSize: 96, fontWeight: '900', lineHeight: 110 },
  resultadoTitulo: { color: '#ffffff', fontSize: 34, fontWeight: '900', textAlign: 'center' },
  resultadoMensaje: { color: '#ffffffe6', fontSize: 17, textAlign: 'center' },
  ficha: { backgroundColor: '#00000033', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', marginTop: 8, alignSelf: 'stretch' },
  fichaNombre: { color: '#ffffff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  fichaDato: { color: '#ffffffd9', fontSize: 15, marginTop: 4, textAlign: 'center' },
  tocar: { color: '#ffffffb3', fontSize: 14, marginTop: 24 },
});
