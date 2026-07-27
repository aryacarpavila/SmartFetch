/**
 * Error controlado para respuestas HTTP que SmartFetch considera fallidas.
 */
export class HttpError extends Error {
  /** Código de estado HTTP recibido. */
  public readonly status: number;

  /** Respuesta original, disponible para inspeccionar headers o cuerpo. */
  public readonly response: Response;

  /**
   * Crea un error a partir de una respuesta HTTP.
   *
   * @param response - Respuesta fallida devuelta por el servidor.
   */
  public constructor(response: Response) {
    super(`Error del servidor. Código de estado: ${response.status}`);
    this.name = 'HttpError';
    this.status = response.status;
    this.response = response;
  }
}
