import { ForbiddenException } from '@nestjs/common';

export const SUPPORT_EMAIL = 'soporte@ubik.cl';

// Error con el detalle que el frontend usa para mostrar el aviso de cuenta suspendida
export function accountSuspendedError(user: { statusReason: string | null; statusChangedAt: Date | null }) {
  return new ForbiddenException({
    statusCode: 403,
    code: 'ACCOUNT_SUSPENDED',
    message: `Tu cuenta se encuentra suspendida. Para dudas o consultas escribe a ${SUPPORT_EMAIL}`,
    reason: user.statusReason,
    suspendedAt: user.statusChangedAt,
    supportEmail: SUPPORT_EMAIL,
  });
}

export function accountUnderReviewError() {
  return new ForbiddenException({
    statusCode: 403,
    code: 'ACCOUNT_UNDER_REVIEW',
    message: 'Tu cuenta está en revisión. Mientras dure la revisión solo puedes ver eventos.',
  });
}
