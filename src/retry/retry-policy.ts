/**
 * Información disponible después de un intento fallido.
 */
export interface RetryContext {
  /** Índice del intento que acaba de fallar; comienza en cero. */
  readonly attempt: number;
  /** Error producido por fetch, cuando no hubo una respuesta HTTP. */
  readonly error?: unknown;
  /** Respuesta HTTP fallida, cuando el servidor sí respondió. */
  readonly response?: Response;
}

/**
 * Contrato Strategy para personalizar la decisión y espera de los reintentos.
 */
export interface RetryPolicy {
  /**
   * Determina si el fallo recibido admite un nuevo intento.
   *
   * @param context - Información del intento fallido.
   * @returns `true` cuando el fallo es recuperable.
   */
  shouldRetry(context: RetryContext): boolean;

  /**
   * Calcula cuánto esperar antes del siguiente intento.
   *
   * @param context - Información del intento fallido.
   * @returns Tiempo de espera en milisegundos.
   */
  getDelayMs(context: RetryContext): number;
}

/**
 * Identifica errores de cancelación para evitar reintentar una petición abortada.
 *
 * @param error - Valor capturado durante la petición.
 * @returns `true` cuando el valor representa un `AbortError`.
 */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object'
    && error !== null
    && 'name' in error
    && error.name === 'AbortError'
  );
}

/**
 * Política predeterminada: reintenta errores de red, timeouts y respuestas 5xx.
 *
 * El retraso utiliza backoff exponencial. Su valor predeterminado es cero para
 * conservar el comportamiento inmediato de la primera versión de SmartFetch.
 */
export class DefaultRetryPolicy implements RetryPolicy {
  /**
   * Crea la política predeterminada.
   *
   * @param baseDelayMs - Espera base para el backoff exponencial.
   */
  public constructor(private readonly baseDelayMs = 0) {}

  /** @inheritdoc */
  public shouldRetry(context: RetryContext): boolean {
    if (context.response !== undefined) {
      return context.response.status >= 500 && context.response.status <= 599;
    }

    return context.error !== undefined && !isAbortError(context.error);
  }

  /** @inheritdoc */
  public getDelayMs(context: RetryContext): number {
    return this.baseDelayMs * (2 ** context.attempt);
  }
}
