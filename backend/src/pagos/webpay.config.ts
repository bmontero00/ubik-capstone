import { IntegrationApiKeys, IntegrationCommerceCodes, WebpayPlus } from 'transbank-sdk';

// Configuración de Webpay Plus. Sin variables de entorno se usa el ambiente de integración de
// Transbank con su comercio de prueba público (no mueve dinero real). Para producción se necesitan
// el código de comercio y la API key que entrega Transbank al certificar el comercio:
//   WEBPAY_AMBIENTE=produccion  WEBPAY_CODIGO_COMERCIO=...  WEBPAY_API_KEY=...
// API_URL_PUBLICA es la dirección del backend a la que Transbank devuelve al comprador y
// FRONTEND_URL, la del sitio al que lo enviamos después con el resultado.
export const webpayConfig = () => {
  const produccion = process.env.WEBPAY_AMBIENTE === 'produccion';
  return {
    produccion,
    codigoComercio: process.env.WEBPAY_CODIGO_COMERCIO || IntegrationCommerceCodes.WEBPAY_PLUS,
    apiKey: process.env.WEBPAY_API_KEY || IntegrationApiKeys.WEBPAY,
    urlRetorno: `${(process.env.API_URL_PUBLICA || 'http://localhost:3000').replace(/\/$/, '')}/pagos/webpay/retorno`,
    frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:3001').replace(/\/$/, ''),
    // El pago simulado (sin pasarela) solo existe fuera de producción, para pruebas rápidas
    pagoSimulado: !produccion,
  };
};

export function webpayTransaction() {
  const { produccion, codigoComercio, apiKey } = webpayConfig();
  if (produccion && (!process.env.WEBPAY_CODIGO_COMERCIO || !process.env.WEBPAY_API_KEY)) {
    throw new Error('Faltan WEBPAY_CODIGO_COMERCIO y WEBPAY_API_KEY para usar Webpay en producción');
  }
  return produccion
    ? WebpayPlus.Transaction.buildForProduction(codigoComercio, apiKey)
    : WebpayPlus.Transaction.buildForIntegration(codigoComercio, apiKey);
}
