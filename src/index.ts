/**
 * Opciones para la función smart_fetch.
 */
export interface FetchOptions extends RequestInit {
  /** Tiempo máximo en milisegundos para esperar la respuesta. */
  timeout_ms?: number;
  /** Número de intentos a realizar si la petición falla por error de servidor o red. */
  max_retries?: number;
}

/**
 * Función wrapper sobre fetch nativo que permite timeouts y reintentos automáticos.
 * 
 * @param url_path - La URL a la cual se hará la petición.
 * @param options - Opciones adicionales de la petición.
 * @returns Una promesa que resuelve con la respuesta de la petición.
 */
export async function smart_fetch(url_path: string, options: FetchOptions = {}): Promise<Response> {
  const { timeout_ms, max_retries = 0, ...fetch_options } = options;
  
  let current_attempt = 0;
  let last_error: any = null;

  while (current_attempt <= max_retries) {
    try {
      const controller = new AbortController();
      const signal = controller.signal;
      
      let timeout_id: ReturnType<typeof setTimeout> | undefined;
      
      if (timeout_ms) {
        timeout_id = setTimeout(() => {
          controller.abort();
        }, timeout_ms);
      }

      const response = await fetch(url_path, {
        ...fetch_options,
        signal,
      });

      if (timeout_id) {
        clearTimeout(timeout_id);
      }

      // Errores de servidor (5xx)
      if (response.status >= 500 && response.status < 600) {
        throw new Error(`Error del servidor. Código de estado: ${response.status}`);
      }

      return response;
    } catch (error: any) {
      last_error = error;
      current_attempt++;
    }
  }

  throw last_error;
}
