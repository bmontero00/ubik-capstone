import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EventoApp, Sesion, cargarServidor, cargarSesion, cerrarSesion, fetchEventos, onSesionExpirada } from './src/api';
import Inicio from './src/pantallas/Inicio';
import Eventos from './src/pantallas/Eventos';
import Validar from './src/pantallas/Validar';
import Historial from './src/pantallas/Historial';
import { c } from './src/tema';

// UBIK Acceso: app para validar entradas en el acceso de los eventos.
// Navegación simple por estado: inicio → eventos → validar ↔ historial.
type Vista = { pantalla: 'eventos' } | { pantalla: 'validar'; evento: EventoApp } | { pantalla: 'historial'; evento: EventoApp };

export default function App() {
  const [listo, setListo] = useState(false);
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [vista, setVista] = useState<Vista>({ pantalla: 'eventos' });

  useEffect(() => {
    (async () => {
      await cargarServidor();
      setSesion(await cargarSesion());
      setListo(true);
    })();
    // Token vencido, acceso revocado o celular desvinculado: vuelve al inicio
    onSesionExpirada(() => { cerrarSesion(); setSesion(null); setVista({ pantalla: 'eventos' }); });
  }, []);

  // El equipo de acceso tiene un solo evento: entra directo a validar
  const entrar = async (s: Sesion) => {
    setSesion(s);
    if (s.tipo === 'equipo') {
      const evento = await fetchEventos().then((l) => l[0]).catch(() => undefined);
      setVista(evento ? { pantalla: 'validar', evento } : { pantalla: 'eventos' });
    } else {
      setVista({ pantalla: 'eventos' });
    }
  };

  const salir = async () => {
    await cerrarSesion();
    setSesion(null);
    setVista({ pantalla: 'eventos' });
  };

  let contenido: React.ReactNode;
  if (!listo) contenido = <View style={{ flex: 1, backgroundColor: c.fondo, justifyContent: 'center' }}><ActivityIndicator color={c.esmeraldaClaro} /></View>;
  else if (!sesion) contenido = <Inicio onEntrar={entrar} />;
  else if (vista.pantalla === 'validar') contenido = <Validar evento={vista.evento} onVolver={() => setVista({ pantalla: 'eventos' })} onHistorial={() => setVista({ pantalla: 'historial', evento: vista.evento })} />;
  else if (vista.pantalla === 'historial') contenido = <Historial evento={vista.evento} onVolver={() => setVista({ pantalla: 'validar', evento: vista.evento })} />;
  else contenido = <Eventos sesion={sesion} onElegir={(evento) => setVista({ pantalla: 'validar', evento })} onSalir={salir} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {contenido}
    </SafeAreaProvider>
  );
}
