import type { Metadata } from 'next';
import LegalPage from '../../components/LegalPage';
import { SUPPORT_EMAIL } from '../../components/Footer';

export const metadata: Metadata = { title: 'Política de privacidad · UBIK' };

export default function PrivacidadPage() {
  return (
    <LegalPage
      title="Política de privacidad"
      updated="noviembre de 2026"
      intro="En UBIK cuidamos los datos personales de quienes usan la plataforma. Aquí explicamos qué datos pedimos, para qué los usamos y cómo puedes ejercer tus derechos, conforme a la Ley N° 19.628 sobre protección de la vida privada."
      sections={[
        {
          title: 'Qué datos recopilamos',
          paragraphs: [
            'Al crear tu cuenta: nombre, correo y contraseña (que guardamos cifrada).',
            'Si te registras como organizador: RUT, teléfono, nombre de la organización, descripción de tus eventos y, si lo indicas, una red social. Los usamos para verificar tu identidad.',
            'Al comprar o confirmar entradas: nombre, apellido, RUT, celular y correo de cada asistente, porque las entradas son nominativas.',
            'Tu ubicación, solo si das permiso en el navegador, para mostrarte eventos cercanos. No la guardamos en nuestros servidores.',
          ],
        },
        {
          title: 'Para qué los usamos',
          paragraphs: [
            'Para operar tu cuenta, emitir y validar entradas, verificar organizadores, prevenir fraudes y reventa, y comunicarte cambios en los eventos a los que asistirás.',
            'No vendemos tus datos ni los usamos con fines publicitarios de terceros.',
          ],
        },
        {
          title: 'Con quién los compartimos',
          paragraphs: [
            'El organizador de un evento podrá conocer los datos de las entradas emitidas para su evento, solo para controlar el acceso.',
            'Los pagos se procesarán a través de proveedores de pago autorizados; UBIK no almacena datos de tarjetas.',
            'Tu perfil público de organizador muestra solo el nombre de la organización, su descripción y sus eventos: nunca tu RUT, teléfono ni correo.',
          ],
        },
        {
          title: 'Tus derechos',
          paragraphs: [
            `Puedes solicitar acceso, rectificación, cancelación u oposición al tratamiento de tus datos escribiendo a ${SUPPORT_EMAIL}. Responderemos dentro de los plazos legales.`,
          ],
        },
        {
          title: 'Seguridad y conservación',
          paragraphs: [
            'Aplicamos medidas técnicas razonables para proteger tus datos y los conservamos mientras tu cuenta esté activa o lo exija la ley.',
          ],
        },
      ]}
    />
  );
}
