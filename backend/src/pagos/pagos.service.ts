import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { EstadoTransaccion, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.guards';
import { ComprasService } from '../compras/compras.service';
import { webpayConfig, webpayTransaction } from './webpay.config';

// Minutos que se reserva la compra mientras el comprador está en el formulario de Webpay
// (Transbank da unos 5 minutos para completarlo; se deja margen para el retorno)
const MINUTOS_EN_PASARELA = 10;

// Resultado que recibe el frontend en ?pago=...
export type ResultadoPago = 'aprobado' | 'rechazado' | 'anulado' | 'reversado' | 'error';

const RESULTADO_POR_ESTADO: Record<EstadoTransaccion, ResultadoPago> = {
  INICIADA: 'anulado',
  AUTORIZADA: 'aprobado',
  RECHAZADA: 'rechazado',
  ANULADA: 'anulado',
  REVERSADA: 'reversado',
  ERROR: 'error',
};

// Parámetros con los que Transbank devuelve al comprador a la URL de retorno
export interface RetornoWebpay {
  token_ws?: string; // flujo normal: el comprador terminó el formulario (aprobado o rechazado)
  TBK_TOKEN?: string; // el comprador anuló el pago o hubo un error en el formulario
  TBK_ORDEN_COMPRA?: string; // junto con TBK_ID_SESION y sin token: se agotó el tiempo
  TBK_ID_SESION?: string;
}

@Injectable()
export class PagosService {
  private readonly logger = new Logger('Webpay');

  constructor(
    private readonly prisma: PrismaService,
    private readonly compras: ComprasService,
  ) {}

  configuracion() {
    const config = webpayConfig();
    return { webpay: { ambiente: config.produccion ? 'produccion' : 'integracion' }, pagoSimulado: config.pagoSimulado };
  }

  // Crea la transacción en Webpay y devuelve a dónde enviar al comprador (formulario con token_ws)
  async iniciarWebpay(compraId: string, user: AuthenticatedUser) {
    const compra = await this.compras.findPayable(compraId, user);
    // Orden de compra única por intento: código de la compra + marca de tiempo (máx. 26 caracteres)
    const ordenCompra = `${compra.codigo.replace('-', '')}${Date.now().toString(36).toUpperCase()}`;

    let respuesta: { token: string; url: string };
    try {
      respuesta = await webpayTransaction().create(ordenCompra, compra.id, compra.total, webpayConfig().urlRetorno);
    } catch (error) {
      this.logger.error(`No se pudo crear la transacción ${ordenCompra}: ${(error as Error).message}`);
      throw new ServiceUnavailableException('No pudimos conectar con Webpay. Intenta nuevamente en unos minutos.');
    }

    // La reserva no debe vencer mientras el comprador está pagando
    const expiraEn = new Date(Math.max(compra.expiraEn?.getTime() ?? 0, Date.now() + MINUTOS_EN_PASARELA * 60_000));
    await this.prisma.$transaction([
      // Un intento anterior que quedó abierto (ej. cerró la pestaña de Webpay) se da por anulado
      this.prisma.transaccionPago.updateMany({ where: { compraId: compra.id, estado: 'INICIADA' }, data: { estado: 'ANULADA' } }),
      this.prisma.transaccionPago.create({
        data: { medio: 'WEBPAY', token: respuesta.token, ordenCompra, monto: compra.total, compraId: compra.id },
      }),
      this.prisma.compra.update({ where: { id: compra.id }, data: { expiraEn } }),
    ]);
    return { url: respuesta.url, token: respuesta.token };
  }

  // Procesa la vuelta desde Webpay y devuelve la URL del sitio a la que se redirige al comprador
  async procesarRetorno(params: RetornoWebpay): Promise<string> {
    const destino = (resultado: ResultadoPago, compraId?: string) =>
      `${webpayConfig().frontendUrl}/?pago=${resultado}${compraId ? `&compra=${compraId}` : ''}`;
    const { token_ws, TBK_TOKEN, TBK_ORDEN_COMPRA } = params;

    // Anulado por el comprador, tiempo agotado o error en el formulario: no hay nada que confirmar
    if (!token_ws || TBK_TOKEN) {
      const token = TBK_TOKEN || token_ws;
      const tx = token
        ? await this.prisma.transaccionPago.findUnique({ where: { token } })
        : TBK_ORDEN_COMPRA
          ? await this.prisma.transaccionPago.findUnique({ where: { ordenCompra: TBK_ORDEN_COMPRA } })
          : null;
      if (!tx) return destino('error');
      if (tx.estado === 'INICIADA') {
        await this.prisma.transaccionPago.update({ where: { id: tx.id }, data: { estado: 'ANULADA', respuesta: { ...params } } });
      }
      return destino(RESULTADO_POR_ESTADO[tx.estado], tx.compraId);
    }

    const tx = await this.prisma.transaccionPago.findUnique({ where: { token: token_ws } });
    if (!tx) return destino('error');
    // Si el comprador recarga la página de retorno, la transacción ya está procesada
    if (tx.estado !== 'INICIADA') return destino(RESULTADO_POR_ESTADO[tx.estado], tx.compraId);

    let r: Record<string, any>;
    try {
      r = await webpayTransaction().commit(token_ws);
    } catch (error) {
      this.logger.error(`No se pudo confirmar la transacción ${tx.ordenCompra}: ${(error as Error).message}`);
      await this.prisma.transaccionPago.update({ where: { id: tx.id }, data: { estado: 'ERROR' } });
      return destino('error', tx.compraId);
    }

    const datos = {
      codigoRespuesta: r.response_code ?? null,
      codigoAutorizacion: r.authorization_code ?? null,
      tipoPago: r.payment_type_code ?? null,
      cuotas: r.installments_number ?? null,
      montoCuota: r.installments_amount ?? null,
      ultimosDigitos: r.card_detail?.card_number ?? null,
      fechaTransaccion: r.transaction_date ? new Date(r.transaction_date) : null,
      respuesta: r as Prisma.InputJsonValue,
    };
    const aprobado = r.response_code === 0 && r.status === 'AUTHORIZED' && r.amount === tx.monto && r.buy_order === tx.ordenCompra;
    if (!aprobado) {
      // La compra sigue pendiente: puede reintentar mientras dure la reserva
      await this.prisma.transaccionPago.update({ where: { id: tx.id }, data: { estado: 'RECHAZADA', ...datos } });
      return destino('rechazado', tx.compraId);
    }

    // Se confirma solo si la compra sigue reservada y el evento sigue publicado
    const { count } = await this.prisma.compra.updateMany({
      where: { id: tx.compraId, estado: 'PENDIENTE_PAGO', evento: { status: 'PUBLISHED' } },
      data: { estado: 'PAGADA', fechaPago: new Date(), medioPago: 'WEBPAY', expiraEn: null },
    });
    if (count) {
      await this.prisma.transaccionPago.update({ where: { id: tx.id }, data: { estado: 'AUTORIZADA', ...datos } });
      return destino('aprobado', tx.compraId);
    }

    // El banco aprobó, pero la compra ya no estaba vigente (venció, se anuló o el evento cambió): se devuelve el dinero
    try {
      const reembolso = await webpayTransaction().refund(token_ws, tx.monto);
      await this.prisma.transaccionPago.update({
        where: { id: tx.id },
        data: { estado: 'REVERSADA', ...datos, respuesta: { commit: r, refund: reembolso } as Prisma.InputJsonValue },
      });
      return destino('reversado', tx.compraId);
    } catch (error) {
      this.logger.error(`Pago ${tx.ordenCompra} aprobado sin compra vigente y no se pudo reversar: ${(error as Error).message}`);
      await this.prisma.transaccionPago.update({ where: { id: tx.id }, data: { estado: 'ERROR', ...datos } });
      return destino('error', tx.compraId);
    }
  }
}
