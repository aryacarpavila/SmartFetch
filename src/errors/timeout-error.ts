/**
 * Error controlado para una petición que excede su tiempo de espera.
 */
export class TimeoutError extends Error {
  /** Tiempo máximo configurado para cada intento, en milisegundos. */
  public readonly timeout_ms: number;

  /**
   * Crea un error de timeout.
   *
   * @param timeout_ms - Tiempo máximo configurado, en milisegundos.
   */
  public constructor(timeout_ms: number) {
    super(
      `La petición fue cancelada porque excedió el tiempo límite de ${timeout_ms}ms.`,
    );
    this.name = 'TimeoutError';
    this.timeout_ms = timeout_ms;
  }
}
