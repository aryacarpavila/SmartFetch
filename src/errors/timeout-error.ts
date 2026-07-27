/**
 * Error controlado para una petición que excede su tiempo de espera.
 */
export class TimeoutError extends Error {
  /** Tiempo máximo configurado para cada intento, en milisegundos. */
  public readonly timeoutMs: number;

  /**
   * Crea un error de timeout.
   *
   * @param timeoutMs - Tiempo máximo configurado, en milisegundos.
   */
  public constructor(timeoutMs: number) {
    super(
      `La petición fue cancelada porque excedió el tiempo límite de ${timeoutMs}ms.`,
    );
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}
