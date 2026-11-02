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
          title: 'Cambios y cancelaciones',
          paragraphs: [
            'Si un evento se posterga, tus entradas siguen siendo válidas para la nueva fecha. Si se cancela, el organizador informará en la bitácora del evento cómo se gestionarán las devoluciones.',
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
