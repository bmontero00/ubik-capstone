import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { c, s } from '../tema';

// Cámara que lee códigos QR. Evita leer el mismo código varias veces seguidas mientras sigue frente
// a la cámara, y no lee nada mientras "pausado" es true (ej. mientras se muestra un resultado).
export default function Escaner({ onCodigo, pausado = false, alto = 320 }: { onCodigo: (codigo: string) => void; pausado?: boolean; alto?: number }) {
  const [permiso, pedirPermiso] = useCameraPermissions();
  const ultimo = useRef<{ codigo: string; en: number } | null>(null);

  if (!permiso) return <View style={[st.caja, { height: alto }]} />;
  if (!permiso.granted) {
    return (
      <View style={[st.caja, st.centro, { height: alto }]}>
        <Text style={st.texto}>Necesitamos la cámara para escanear el código QR.</Text>
        {permiso.canAskAgain ? (
          <Pressable style={[s.boton, { paddingHorizontal: 20 }]} onPress={pedirPermiso}>
            <Text style={s.botonTexto}>Permitir cámara</Text>
          </Pressable>
        ) : (
          <Text style={[st.texto, { color: c.tenue }]}>Activa el permiso de cámara para UBIK Acceso en los ajustes del celular, o escribe el código a mano.</Text>
        )}
      </View>
    );
  }

  return (
    <View style={[st.caja, { height: alto }]}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={pausado ? undefined : ({ data }) => {
          const codigo = data.trim();
          const ahora = Date.now();
          if (ultimo.current && ultimo.current.codigo === codigo && ahora - ultimo.current.en < 4000) return;
          ultimo.current = { codigo, en: ahora };
          onCodigo(codigo);
        }}
      />
      {/* Marco guía */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, st.centro]}>
        <View style={st.marco} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  caja: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#020617', borderWidth: 1, borderColor: c.borde },
  centro: { alignItems: 'center', justifyContent: 'center', gap: 14, padding: 20 },
  texto: { color: c.suave, fontSize: 15, textAlign: 'center' },
  marco: { width: 220, height: 220, borderRadius: 24, borderWidth: 3, borderColor: c.esmeraldaClaro, opacity: 0.9 },
});
