import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface Correo {
  para: string;
  asunto: string;
  html: string;
  texto: string; // versión en texto plano, para clientes que no muestran HTML
}

// Cuenta de la bandeja de prueba (Ethereal): se crea una vez y se guarda en este archivo local
// (ignorado por git) para que los correos de desarrollo queden siempre en la misma bandeja
const ARCHIVO_BANDEJA = join(process.cwd(), '.correo-pruebas.json');

// Logo de UBIK (PNG, generado desde frontend/src/app/icon.svg): va incrustado en cada correo y la
// plantilla lo muestra con "cid:logo-ubik". Los clientes de correo no muestran SVG.
const LOGO = { filename: 'logo-ubik.png', path: join(process.cwd(), 'assets', 'logo-ubik.png'), cid: 'logo-ubik' };

// Envío de correos. Con SMTP_HOST configurado usa ese servidor (ej. Resend o Brevo en producción):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
// Sin él, usa una bandeja de prueba de Ethereal: los correos no llegan a nadie, pero se ven tal
// cual en https://ethereal.email (la consola del backend muestra el enlace de cada correo).
@Injectable()
export class CorreoService {
  private readonly logger = new Logger('Correo');
  private transporte: Promise<Transporter> | null = null;
  private readonly remitente = process.env.MAIL_FROM || '"UBIK - Eventos y Comunidad" <no-responder@ubik.cl>';
  private readonly esPrueba = !process.env.SMTP_HOST;

  private obtenerTransporte(): Promise<Transporter> {
    this.transporte ??= this.crearTransporte();
    return this.transporte;
  }

  private async crearTransporte(): Promise<Transporter> {
    if (!this.esPrueba) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
    }
    let cuenta: { user: string; pass: string };
    if (existsSync(ARCHIVO_BANDEJA)) {
      cuenta = JSON.parse(readFileSync(ARCHIVO_BANDEJA, 'utf8'));
    } else {
      const nueva = await nodemailer.createTestAccount();
      cuenta = { user: nueva.user, pass: nueva.pass };
      writeFileSync(ARCHIVO_BANDEJA, JSON.stringify(cuenta, null, 2));
    }
    this.logger.log(`Bandeja de prueba: https://ethereal.email/login · usuario ${cuenta.user} · clave ${cuenta.pass}`);
    return nodemailer.createTransport({ host: 'smtp.ethereal.email', port: 587, auth: cuenta });
  }

  // Envía el correo y registra el resultado. No lanza errores: quien envía no debe fallar ni
  // demorar su respuesta si el servidor de correo tiene problemas.
  async enviar(correo: Correo): Promise<void> {
    try {
      const transporte = await this.obtenerTransporte();
      const info = await transporte.sendMail({
        from: this.remitente,
        to: correo.para,
        subject: correo.asunto,
        html: correo.html,
        text: correo.texto,
        attachments: existsSync(LOGO.path) ? [LOGO] : [],
      });
      const vistaPrevia = this.esPrueba ? nodemailer.getTestMessageUrl(info) : null;
      this.logger.log(`"${correo.asunto}" enviado a ${correo.para}${vistaPrevia ? ` · vista previa: ${vistaPrevia}` : ''}`);
    } catch (error) {
      this.logger.error(`No se pudo enviar "${correo.asunto}" a ${correo.para}: ${(error as Error).message}`);
    }
  }
}
