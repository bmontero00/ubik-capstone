# UBIK Acceso — app de validación de entradas

App móvil (Expo / React Native) para validar las entradas de los eventos en el acceso, escaneando su
código QR o escribiendo el código a mano. Cada entrada se acepta una sola vez.

Pueden usarla:

- **El organizador**, con su correo y contraseña de UBIK: ve sus eventos de hoy y los próximos.
- **Su equipo de acceso**, sin cuenta: el organizador crea un acceso en UBIK web
  (*Mis eventos → Equipo de acceso*) y le entrega un código `VAL-XXXX-XXXX`. Ese código vincula el
  celular a un solo evento, y el acceso puede estar limitado a ciertos tipos de entrada (ej. solo VIP).

## Pantallas

1. **Inicio**: "Tengo un código" (vincular con el código o su QR) o "Soy organizador".
2. **Eventos**: eventos de hoy y próximos con "ingresados / vendidas" (el equipo entra directo a su evento).
3. **Validar**: cámara para el QR, código a mano, resultado a pantalla completa con vibración
   (verde: puede ingresar, ámbar: ya ingresó u otro acceso, rojo: no pasa) y contador en vivo
   que también suma los ingresos de las otras puertas.
4. **Historial**: últimos escaneos del evento con resultado, hora y quién validó.

## Cómo probarla en tu celular (gratis)

Requisitos: el backend de UBIK corriendo en tu computador (`backend`, `npm run start:dev`) y el
celular en la **misma red Wi-Fi** que el computador.

1. Instala **Expo Go** desde Google Play o App Store.
2. Busca la IP de tu computador. En Windows: `ipconfig` → "Dirección IPv4" (ej. `192.168.1.20`).
3. Copia `.env.example` como `.env.local` y pon esa IP:
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.20:3000
   ```
   (También se puede cambiar desde la app: "Servidor · Cambiar" en la pantalla de inicio.)
4. Instala y levanta la app:
   ```bash
   cd mobile
   npm install
   npx expo start
   ```
5. Escanea el QR que aparece en la terminal: en Android con Expo Go, en iPhone con la cámara.

Si el celular no se conecta:

- **Firewall de Windows**: la primera vez que corre el backend, Windows pregunta si permite el acceso
  a redes privadas: acéptalo (o permite Node.js en el firewall para redes privadas).
- **Wi-Fi de la universidad**: muchas redes bloquean la conexión entre equipos. Usa el modo túnel
  (`npx expo start --tunnel`) para la app y un túnel para el backend, o comparte internet desde
  el celular al computador.

## Probarla en el computador

`npx expo start --web` abre la app en el navegador (útil para revisar pantallas; la cámara depende
del navegador). Usa `http://localhost:3000` como servidor.

## Instalar la app sin Expo Go (Android, opcional)

Para dejarla instalada como app propia se genera un `.apk` con EAS Build (plan gratuito con un cupo
mensual de builds): `npx eas-cli@latest build -p android --profile preview`. En iPhone, instalarla
fuera de Expo Go requiere un Mac con Xcode; para la demo basta con Expo Go.
