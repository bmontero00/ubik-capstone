import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CorreoService } from '../correo/correo.service';
import { correoCodigoRecuperacion, correoContrasenaActualizada } from '../correo/plantillas';
import { Limitador } from '../common/limitador';

export const RECUPERACION = {
  minutosVigencia: 15,
  maxIntentos: 5, // intentos fallidos por código
};

const QUINCE_MINUTOS = 15 * 60_000;
// Solicitudes de código: por correo y por IP (frena el abuso y el envío masivo de correos)
const solicitudesPorCorreo = new Limitador(3, QUINCE_MINUTOS);
const solicitudesPorIp = new Limitador(10, QUINCE_MINUTOS);
// Intentos de ingresar un código por IP (además del máximo por código)
const verificacionesPorIp = new Limitador(30, QUINCE_MINUTOS);

const MENSAJE_SOLICITUD =
  'Si el correo está registrado en UBIK, te enviamos un código de verificación. Revisa tu bandeja de entrada y la carpeta de spam.';

const demasiadosIntentos = () =>
  new HttpException(
    { statusCode: 429, code: 'DEMASIADOS_INTENTOS', message: 'Hiciste demasiados intentos. Espera unos minutos y vuelve a intentarlo.' },
    HttpStatus.TOO_MANY_REQUESTS,
  );

// Recuperación de contraseña con un código de 6 dígitos enviado por correo. Quien conoce el correo
// de otra persona no puede cambiar su contraseña: necesita acceso a esa bandeja para leer el código.
@Injectable()
export class RecuperacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly correo: CorreoService,
  ) {}

  private buscarUsuario(email: string) {
    return this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, name: true, email: true },
    });
  }

  // Siempre responde lo mismo, exista o no la cuenta, para no revelar qué correos están registrados.
  // El correo se envía en segundo plano: así la respuesta tarda lo mismo en ambos casos.
  async solicitar(email: string, ip: string) {
    if (!solicitudesPorIp.permitir(ip) || !solicitudesPorCorreo.permitir(email.toLowerCase())) throw demasiadosIntentos();

    const usuario = await this.buscarUsuario(email);
    if (usuario) {
      const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const ahora = new Date();
      await this.prisma.$transaction([
        // Pedir un código nuevo anula los anteriores que sigan vigentes
        this.prisma.codigoRecuperacion.updateMany({
          where: { usuarioId: usuario.id, usadoEn: null, anuladoEn: null },
          data: { anuladoEn: ahora },
        }),
        this.prisma.codigoRecuperacion.create({
          data: {
            usuarioId: usuario.id,
            codigoHash: await bcrypt.hash(codigo, 10),
            expiraEn: new Date(ahora.getTime() + RECUPERACION.minutosVigencia * 60_000),
          },
        }),
      ]);
      void this.correo.enviar({
        para: usuario.email,
        ...correoCodigoRecuperacion({ nombre: usuario.name, codigo, minutos: RECUPERACION.minutosVigencia }),
      });
    }
    return { mensaje: MENSAJE_SOLICITUD, minutosVigencia: RECUPERACION.minutosVigencia };
  }

  // Revisa el código sin usarlo (paso intermedio antes de elegir la nueva contraseña)
  async verificar(email: string, codigo: string, ip: string) {
    await this.validarCodigo(email, codigo, ip);
    return { valido: true };
  }

  async restablecer(email: string, codigo: string, password: string, ip: string) {
    const { usuario, registro } = await this.validarCodigo(email, codigo, ip);
    const fecha = new Date();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: usuario.id },
        // contrasenaCambiadaEn invalida las sesiones abiertas antes de este momento
        data: { password: await bcrypt.hash(password, 10), contrasenaCambiadaEn: fecha },
      }),
      this.prisma.codigoRecuperacion.update({ where: { id: registro.id }, data: { usadoEn: fecha } }),
    ]);
    void this.correo.enviar({ para: usuario.email, ...correoContrasenaActualizada({ nombre: usuario.name, fecha }) });
    return { mensaje: 'Tu contraseña fue actualizada. Ya puedes iniciar sesión con ella.' };
  }

  // Busca el último código vigente del usuario y lo compara. Cada error suma un intento; al
  // agotarlos, el código se anula y hay que pedir otro.
  private async validarCodigo(email: string, codigo: string, ip: string) {
    if (!verificacionesPorIp.permitir(ip)) throw demasiadosIntentos();
    const invalido = () =>
      new BadRequestException({ code: 'CODIGO_INVALIDO', message: 'El código no es válido o ya venció. Pide uno nuevo.' });

    const usuario = await this.buscarUsuario(email);
    if (!usuario) throw invalido();
    const registro = await this.prisma.codigoRecuperacion.findFirst({
      where: { usuarioId: usuario.id, usadoEn: null, anuladoEn: null, expiraEn: { gt: new Date() } },
      orderBy: { fechaCreacion: 'desc' },
    });
    if (!registro) throw invalido();

    if (!(await bcrypt.compare(codigo, registro.codigoHash))) {
      const intentos = registro.intentos + 1;
      const agotado = intentos >= RECUPERACION.maxIntentos;
      await this.prisma.codigoRecuperacion.update({
        where: { id: registro.id },
        data: { intentos, ...(agotado && { anuladoEn: new Date() }) },
      });
      const restantes = RECUPERACION.maxIntentos - intentos;
      throw new BadRequestException({
        code: agotado ? 'CODIGO_AGOTADO' : 'CODIGO_INCORRECTO',
        message: agotado
          ? 'Superaste el número de intentos. Pide un código nuevo.'
          : `El código no es correcto. Te ${restantes === 1 ? 'queda 1 intento' : `quedan ${restantes} intentos`}.`,
        intentosRestantes: restantes,
      });
    }
    return { usuario, registro };
  }
}
