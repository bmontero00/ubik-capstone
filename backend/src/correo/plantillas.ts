// Plantillas de los correos de UBIK. Usan tablas y estilos en línea porque los clientes de correo
// (Gmail, Outlook) no soportan hojas de estilo ni diseños modernos.

const COLORES = {
  marca: '#10b981', // verde UBIK
  marcaClaro: '#ecfdf5',
  marcaBorde: '#a7f3d0',
  cian: '#22d3ee',
  oscuro: '#0f172a',
  texto: '#334155',
  suave: '#64748b',
  fondo: '#f1f5f9',
  borde: '#e2e8f0',
};
const FUENTE = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
export const CORREO_SOPORTE = 'soporte@ubik.cl';

const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] || 'Hola';

// Estructura común: encabezado con la marca, contenido y pie institucional
function layout({ titulo, preencabezado, contenido }: { titulo: string; preencabezado: string; contenido: string }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORES.fondo};font-family:${FUENTE};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapar(preencabezado)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORES.fondo};padding:32px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${COLORES.borde};">
      <tr>
        <td style="background:${COLORES.oscuro};padding:24px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:48px;vertical-align:middle;">
              <img src="cid:logo-ubik" width="48" height="48" alt="UBIK" style="display:block;width:48px;height:48px;border:0;border-radius:12px;">
            </td>
            <td style="padding-left:14px;">
              <div style="font-size:22px;font-weight:800;letter-spacing:1px;color:#ffffff;font-family:${FUENTE};">UBIK</div>
              <div style="font-size:11px;font-weight:600;letter-spacing:2px;color:${COLORES.marca};text-transform:uppercase;font-family:${FUENTE};">Eventos &amp; Comunidad</div>
            </td>
          </tr></table>
        </td>
      </tr>
      <tr><td style="height:4px;background:${COLORES.marca};background-image:linear-gradient(90deg,${COLORES.marca},${COLORES.cian});font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr>
        <td style="padding:36px 32px 28px;color:${COLORES.texto};font-size:15px;line-height:1.6;font-family:${FUENTE};">
          ${contenido}
          <p style="margin:28px 0 0;">Saludos,<br><strong style="color:${COLORES.oscuro};">Equipo UBIK</strong></p>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid ${COLORES.borde};color:${COLORES.suave};font-size:12px;line-height:1.6;text-align:center;font-family:${FUENTE};">
          <strong style="color:${COLORES.texto};">UBIK - Eventos y Comunidad</strong> · Santiago, Chile<br>
          Este es un correo automático, por favor no lo respondas. Si necesitas ayuda, escríbenos a
          <a href="mailto:${CORREO_SOPORTE}" style="color:${COLORES.marca};text-decoration:none;font-weight:600;">${CORREO_SOPORTE}</a>.
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

const aviso = (contenido: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr>
    <td style="background:#f8fafc;border:1px solid ${COLORES.borde};border-left:4px solid ${COLORES.marca};border-radius:8px;padding:14px 16px;font-size:13px;line-height:1.6;color:${COLORES.texto};">${contenido}</td>
  </tr></table>`;

// Código de 6 dígitos para restablecer la contraseña
export function correoCodigoRecuperacion({ nombre, codigo, minutos }: { nombre: string; codigo: string; minutos: number }) {
  const saludo = escapar(primerNombre(nombre));
  const asunto = `${codigo} es tu código para restablecer tu contraseña de UBIK`;
  const html = layout({
    titulo: 'Restablece tu contraseña',
    preencabezado: `Tu código de verificación es ${codigo}. Vence en ${minutos} minutos.`,
    contenido: `
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${COLORES.oscuro};font-family:${FUENTE};">Restablece tu contraseña</h1>
      <p style="margin:0 0 12px;">Hola ${saludo},</p>
      <p style="margin:0 0 24px;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en UBIK. Ingresa el siguiente código de verificación para continuar:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td align="center" style="background:${COLORES.marcaClaro};border:1px solid ${COLORES.marcaBorde};border-radius:12px;padding:24px 12px;">
          <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${COLORES.suave};margin-bottom:8px;">Código de verificación</div>
          <div style="font-family:'Courier New',Consolas,monospace;font-size:38px;font-weight:800;letter-spacing:12px;color:${COLORES.oscuro};padding-left:12px;"><strong>${codigo}</strong></div>
        </td>
      </tr></table>
      <p style="margin:16px 0 0;font-size:13px;color:${COLORES.suave};text-align:center;">El código vence en <strong>${minutos} minutos</strong> y solo puede usarse una vez.</p>
      ${aviso(`<strong style="color:${COLORES.oscuro};">¿No solicitaste este cambio?</strong> Puedes ignorar este correo: tu contraseña seguirá siendo la misma.
        Por tu seguridad, no compartas este código con nadie. El equipo de UBIK nunca te lo pedirá por teléfono, correo ni redes sociales.`)}`,
  });
  const texto = [
    `Hola ${primerNombre(nombre)},`,
    '',
    'Recibimos una solicitud para restablecer la contraseña de tu cuenta en UBIK.',
    `Tu código de verificación es: ${codigo}`,
    `Vence en ${minutos} minutos y solo puede usarse una vez.`,
    '',
    'Si no solicitaste este cambio, ignora este correo: tu contraseña seguirá siendo la misma.',
    'No compartas este código con nadie. El equipo de UBIK nunca te lo pedirá.',
    '',
    'Equipo UBIK - Eventos y Comunidad',
    `Ayuda: ${CORREO_SOPORTE}`,
  ].join('\n');
  return { asunto, html, texto };
}

// Aviso de que la contraseña se cambió (por si no fue la persona dueña de la cuenta)
export function correoContrasenaActualizada({ nombre, fecha }: { nombre: string; fecha: Date }) {
  const saludo = escapar(primerNombre(nombre));
  const cuando = fecha.toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Santiago' });
  const asunto = 'Tu contraseña de UBIK fue actualizada';
  const html = layout({
    titulo: 'Contraseña actualizada',
    preencabezado: 'Te confirmamos que la contraseña de tu cuenta fue cambiada.',
    contenido: `
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${COLORES.oscuro};font-family:${FUENTE};">Tu contraseña fue actualizada</h1>
      <p style="margin:0 0 12px;">Hola ${saludo},</p>
      <p style="margin:0 0 12px;">Te confirmamos que la contraseña de tu cuenta en UBIK se cambió correctamente el <strong>${escapar(cuando)}</strong>.</p>
      <p style="margin:0;">Por seguridad, cerramos las sesiones que estaban abiertas en otros dispositivos. Para volver a ingresar, usa tu nueva contraseña.</p>
      ${aviso(`<strong style="color:${COLORES.oscuro};">¿No fuiste tú?</strong> Escríbenos de inmediato a
        <a href="mailto:${CORREO_SOPORTE}" style="color:${COLORES.marca};font-weight:600;text-decoration:none;">${CORREO_SOPORTE}</a> para proteger tu cuenta.`)}`,
  });
  const texto = [
    `Hola ${primerNombre(nombre)},`,
    '',
    `La contraseña de tu cuenta en UBIK se cambió correctamente el ${cuando}.`,
    'Por seguridad, cerramos las sesiones abiertas en otros dispositivos.',
    '',
    `Si no fuiste tú, escríbenos de inmediato a ${CORREO_SOPORTE}.`,
    '',
    'Equipo UBIK - Eventos y Comunidad',
  ].join('\n');
  return { asunto, html, texto };
}
