import React from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

// Imagotipo de UBIK: el ícono (U que acoge un pin) y la palabra con trazos redondeados en el
// degradado de la marca. Mismo dibujo que frontend/src/components/UbikLogo.tsx y UbikWordmark.tsx.
const TRAZOS_UBIK = [
  'M3.5 6V30a10 10 0 0 0 20 0V6',
  'M35 6V40H45a9.5 9.5 0 0 0 0-19H35M35 6h8.5a7.5 7.5 0 0 1 0 15',
  'M66 6V40',
  'M80 6V40M99 6L82.5 24.5M89 17L100 40',
];

export function Icono({ tamano = 48 }: { tamano?: number }) {
  return (
    <Svg width={tamano} height={tamano} viewBox="0 0 64 64" accessibilityLabel="UBIK">
      <Defs>
        <LinearGradient id="u" x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#34d399" />
          <Stop offset="1" stopColor="#22d3ee" />
        </LinearGradient>
        <LinearGradient id="bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#111a2e" />
          <Stop offset="1" stopColor="#060b16" />
        </LinearGradient>
      </Defs>
      <Rect width="64" height="64" rx="16" fill="url(#bg)" />
      <Path d="M15 12v20a17 17 0 0 0 34 0V12" fill="none" stroke="url(#u)" strokeWidth={9} strokeLinecap="round" />
      <Path d="M32 41.5c-1.1-1.6-8-10.4-8-15.5a8 8 0 0 1 16 0c0 5.1-6.9 13.9-8 15.5z" fill="#f8fafc" />
      <Circle cx="32" cy="26" r="3" fill="#0b1120" />
    </Svg>
  );
}

export function Palabra({ alto = 32 }: { alto?: number }) {
  return (
    <Svg width={(alto * 104) / 46} height={alto} viewBox="0 0 104 46">
      <Defs>
        <LinearGradient id="g" x1="0" y1="0" x2="104" y2="0" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#34d399" />
          <Stop offset="1" stopColor="#22d3ee" />
        </LinearGradient>
      </Defs>
      <G fill="none" stroke="url(#g)" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round">
        {TRAZOS_UBIK.map((d) => <Path key={d} d={d} />)}
      </G>
    </Svg>
  );
}
