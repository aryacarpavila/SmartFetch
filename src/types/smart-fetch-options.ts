/**
 * Entrada aceptada por la API nativa `fetch`.
 */
export type FetchInput = RequestInfo | URL;

/**
 * Opciones nativas de `fetch` extendidas con resiliencia.
 */
export interface SmartFetchOptions extends RequestInit {
  /** Tiempo máximo permitido para cada intento, en milisegundos. */
  timeoutMs?: number;

  /** Cantidad de reintentos adicionales; cero equivale a un único intento. */
  maxRetries?: number;
}
