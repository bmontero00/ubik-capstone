import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Device from 'expo-device';
import { Sesion, cambiarServidor, entrarComoOrganizador, servidorActual, vincular } from '../api';
import Escaner from '../componentes/Escaner';
import { Icono, Palabra } from '../componentes/Logo';
import { c, s } from '../tema';

type Modo = 'organizador' | 'equipo';

// Inicio de sesión: el organizador con su cuenta de UBIK, o alguien del equipo de acceso con el
// código de vinculación (VAL-XXXX-XXXX) que le entregó el organizador (escrito o escaneando su QR).
export default function Inicio({ onEntrar }: { onEntrar: (s: Sesion) => void }) {
  const [modo, setModo] = useState<Modo>('equipo');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [escaneando, setEscaneando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editarServidor, setEditarServidor] = useState(false);
  const [servidor, setServidor] = useState(servidorActual());

  const ejecutar = async (accion: () => Promise<Sesion>) => {
    setBusy(true);
    setError(null);
    try {
      onEntrar(await accion());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión');
    } finally {
      setBusy(false);
    }
  };

  const nombreCelular = Device.modelName ?? (Platform.OS === 'web' ? 'Navegador web' : 'Celular');
  const usarCodigo = (valor: string) => {
    setEscaneando(false);
    setCodigo(valor);
    ejecutar(() => vincular(valor, nombreCelular));
  };

  const guardarServidor = async () => {
    try {
      await cambiarServidor(servidor);
      setEditarServidor(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dirección no válida');
    }
  };

  return (
    <SafeAreaView style={s.pantalla}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[s.contenido, { paddingTop: 36 }]} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }} accessible accessibilityLabel="UBIK">
              <Icono tamano={56} />
              <Palabra alto={46} />
            </View>
            <Text style={st.bajada}>CONTROL DE ACCESO</Text>
            <Text style={[s.subtitulo, { textAlign: 'center' }]}>Valida las entradas de tu evento escaneando su código QR.</Text>
          </View>

          <View style={st.pestanas}>
            {([['equipo', 'Tengo un código'], ['organizador', 'Soy organizador']] as const).map(([id, label]) => (
              <Pressable key={id} onPress={() => { setModo(id); setError(null); }} style={[st.pestana, modo === id && st.pestanaActiva]} accessibilityRole="tab" accessibilityState={{ selected: modo === id }}>
                <Text style={[st.pestanaTexto, modo === id && { color: c.texto }]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {modo === 'equipo' ? (
            <View style={s.tarjeta}>
              <Text style={[s.subtitulo, { marginBottom: 12 }]}>
                Ingresa el código de vinculación que te dio el organizador. Sirve una sola vez y deja este celular listo para validar su evento.
              </Text>
              {escaneando ? (
                <View style={{ gap: 10 }}>
                  <Escaner alto={280} onCodigo={usarCodigo} pausado={busy} />
                  <Pressable style={s.botonSecundario} onPress={() => setEscaneando(false)}>
                    <Text style={s.botonSecundarioTexto}>Escribir el código</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  <TextInput
                    style={[s.input, st.codigo]}
                    value={codigo}
                    onChangeText={(t) => setCodigo(t.toUpperCase())}
                    placeholder="VAL-XXXX-XXXX"
                    placeholderTextColor={c.tenue}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    accessibilityLabel="Código de vinculación"
                  />
                  <Pressable style={[s.boton, busy && { opacity: 0.6 }]} disabled={busy || codigo.trim().length < 8} onPress={() => usarCodigo(codigo)}>
                    {busy && <ActivityIndicator color="#022c22" />}
                    <Text style={s.botonTexto}>Vincular este celular</Text>
                  </Pressable>
                  <Pressable style={s.botonSecundario} onPress={() => setEscaneando(true)}>
                    <Text style={s.botonSecundarioTexto}>Escanear el QR del código</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            <View style={[s.tarjeta, { gap: 12 }]}>
              <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="Correo" placeholderTextColor={c.tenue}
                keyboardType="email-address" autoCapitalize="none" autoComplete="email" accessibilityLabel="Correo" />
              <TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="Contraseña" placeholderTextColor={c.tenue}
                secureTextEntry autoComplete="password" accessibilityLabel="Contraseña" onSubmitEditing={() => ejecutar(() => entrarComoOrganizador(email, password))} />
              <Pressable style={[s.boton, busy && { opacity: 0.6 }]} disabled={busy || !email || !password} onPress={() => ejecutar(() => entrarComoOrganizador(email, password))}>
                {busy && <ActivityIndicator color="#022c22" />}
                <Text style={s.botonTexto}>Iniciar sesión</Text>
              </Pressable>
              <Text style={[s.subtitulo, { fontSize: 12 }]}>Con tu cuenta ves todos tus eventos. Para tu equipo, crea accesos en UBIK web → Mis eventos → Equipo de acceso.</Text>
            </View>
          )}

          {error && <Text style={s.error} accessibilityRole="alert">{error}</Text>}

          <View style={{ marginTop: 8 }}>
            {editarServidor ? (
              <View style={[s.tarjeta, { gap: 10 }]}>
                <Text style={s.etiqueta}>Dirección del servidor</Text>
                <TextInput style={s.input} value={servidor} onChangeText={setServidor} autoCapitalize="none" autoCorrect={false}
                  keyboardType="url" placeholder="http://192.168.1.20:3000" placeholderTextColor={c.tenue} />
                <Text style={[s.subtitulo, { fontSize: 12 }]}>La IP del computador donde corre el backend de UBIK, en la misma red Wi-Fi que este celular.</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable style={[s.botonSecundario, { flex: 1 }]} onPress={() => { setServidor(servidorActual()); setEditarServidor(false); }}>
                    <Text style={s.botonSecundarioTexto}>Cancelar</Text>
                  </Pressable>
                  <Pressable style={[s.boton, { flex: 1 }]} onPress={guardarServidor}>
                    <Text style={s.botonTexto}>Guardar</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setEditarServidor(true)} accessibilityRole="button">
                <Text style={[s.subtitulo, { fontSize: 12, textAlign: 'center' }]}>Servidor: {servidorActual()} · <Text style={{ color: c.cian }}>Cambiar</Text></Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  bajada: { color: c.suave, fontSize: 12, fontWeight: '700', letterSpacing: 4, marginTop: 2 },
  pestanas: { flexDirection: 'row', backgroundColor: c.tarjeta, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: c.borde },
  pestana: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  pestanaActiva: { backgroundColor: c.borde },
  pestanaTexto: { color: c.suave, fontWeight: '700', fontSize: 14 },
  codigo: { fontSize: 22, letterSpacing: 3, textAlign: 'center', fontWeight: '800', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },
});
