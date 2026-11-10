import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

// Acceso a Claude (API de Anthropic). Sin ANTHROPIC_API_KEY queda en "modo de prueba": no se llama a la
// API y cada función que usa IA aplica su propia alternativa local. Si la API falla o rechaza la
// solicitud, también se usa la alternativa: la IA nunca bloquea el funcionamiento del sitio.
@Injectable()
export class IaService {
  private readonly logger = new Logger('IA');
  private readonly client = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ timeout: 60_000, maxRetries: 2 })
    : null;
  readonly modelo = process.env.IA_MODELO || 'claude-opus-5-5';

  constructor() {
    this.logger.log(this.client ? `Claude activo (modelo ${this.modelo})` : 'Modo de prueba: sin ANTHROPIC_API_KEY no se llama a Claude');
  }

  get activa() {
    return !!this.client;
  }

  // Pide una respuesta JSON que cumple el esquema. Devuelve null si no hay API key o si falla.
  async estructurado<T extends z.ZodType>(opciones: {
    esquema: T;
    sistema: string;
    contenido: string;
    esfuerzo?: 'low' | 'medium' | 'high';
    maxTokens?: number;
  }): Promise<z.infer<T> | null> {
    if (!this.client) return null;
    try {
      const respuesta = await this.client.messages.parse({
        model: this.modelo,
        max_tokens: opciones.maxTokens ?? 4000,
        system: opciones.sistema,
        messages: [{ role: 'user', content: opciones.contenido }],
        output_config: { format: zodOutputFormat(opciones.esquema), effort: opciones.esfuerzo ?? 'low' },
      });
      if (respuesta.stop_reason === 'refusal') {
        this.logger.warn(`Claude declinó la solicitud (${respuesta.stop_details?.category ?? 'sin categoría'})`);
        return null;
      }
      if (respuesta.stop_reason === 'max_tokens') {
        this.logger.warn('La respuesta de Claude quedó incompleta (max_tokens)');
        return null;
      }
      return (respuesta.parsed_output as z.infer<T> | null) ?? null;
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) this.logger.error('ANTHROPIC_API_KEY no es válida');
      else if (error instanceof Anthropic.RateLimitError) this.logger.warn('Límite de uso de Claude alcanzado; se usa la alternativa local');
      else if (error instanceof Anthropic.APIError) this.logger.error(`Error de la API de Claude (${error.status}): ${error.message}`);
      else this.logger.error(`No se pudo contactar a Claude: ${(error as Error).message}`);
      return null;
    }
  }
}
