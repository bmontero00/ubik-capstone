import type { Metadata } from 'next';
import LegalPage from '../../components/LegalPage';
import { SUPPORT_EMAIL } from '../../components/Footer';

export const metadata: Metadata = { title: 'Términos y condiciones · UBIK' };

export default function TerminosPage() {
  return (
    <LegalPage
      title="Términos y condiciones"
      updated="noviembre de 2026"
      intro="Estos términos regulan el uso de UBIK, la plataforma para descubrir, publicar y asistir a eventos sociales y comunitarios. Al usar UBIK aceptas estas condiciones."
      sections={[
        {
          title: 'Cuentas',
          paragraphs: [
            'Puedes explorar eventos sin cuenta. Para comprar o confirmar entradas necesitas una cuenta de asistente, y para publicar eventos, una cuenta de organizador verificada por UBIK.',
            'Eres responsable de mantener la confidencialidad de tu contraseña y de la veracidad de los datos que entregas.',
          ],
        },
        {
          title: 'Organizadores y eventos',
          paragraphs: [
            'El organizador es responsable de la realización del evento, de la información que publica y de informar oportunamente cualquier cambio, postergación o cancelación.',
            'UBIK puede revisar, pausar o retirar eventos que infrinjan estos términos o la ley, informando el motivo al organizador.',
          ],
        },
        {
          title: 'Entradas',
          paragraphs: [
            'Las entradas son nominativas: cada una queda a nombre de una persona identificada con su RUT, que deberá presentar su cédula de identidad en el acceso.',
            'Cada persona puede tener una sola entrada vigente por evento, y cada cuenta puede adquirir hasta 10 entradas por evento.',
            'Al comprar, las entradas se reservan por 15 minutos mientras se completa el pago; si no se paga a tiempo, se liberan.',
          ],
        },
        {
          title: 'Restricción de edad',
          paragraphs: [
            'Algunos eventos son solo para mayores de 14, 16 o 18 años. La edad mínima la define el organizador al publicar el evento, se muestra en su detalle y no se puede cambiar después de publicado.',
            'Al comprar o confirmar entradas declaras que cada titular cumple la edad mínima del evento. En el acceso se puede pedir la cédula de identidad para comprobarla.',
            'Si el titular no cumple la edad mínima, no podrá ingresar al evento y la entrada no tendrá devolución. El control de la edad en el acceso es responsabilidad del organizador.',
          ],
        },
        {
          title: 'Uso de la entrada en el acceso',
          paragraphs: [
            'Cada entrada tiene un código único (y su código QR) que vale para un solo ingreso: una vez validado en el acceso, no se puede volver a usar.',
            'No compartas ni publiques tu código. Si otra persona lo presenta antes que tú, UBIK no puede garantizar tu ingreso con esa misma entrada.',
            'El ingreso lo valida el organizador o su equipo de acceso, que puede revisar que la entrada corresponda al tipo y al acceso indicados.',
          ],
        },
        {
          title: 'Devoluciones, cambios y cancelaciones',
          paragraphs: [
            'Las entradas no tienen cambio ni devolución, ni por arrepentimiento ni por no asistir al evento, salvo que el evento sea cancelado.',
            'Si un evento se posterga, tus entradas siguen siendo válidas para la nueva fecha. Si se cancela, se devolverá lo pagado por las entradas, y el organizador informará en la bitácora del evento cómo y en qué plazo.',
            'Esto no limita los derechos que te otorga la Ley N° 19.496 sobre Protección de los Derechos de los Consumidores.',
          ],
        },
        {
          title: 'Contacto',
          paragraphs: [`Para consultas o reclamos escríbenos a ${SUPPORT_EMAIL}.`],
        },
      ]}
    />
  );
}
