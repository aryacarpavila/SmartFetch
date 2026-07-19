/**
 * Opciones para la configuración de peticiones.
 */
export interface FetchOptions extends RequestInit {
  /** Tiempo máximo en milisegundos para esperar la respuesta. */
  timeout_ms?: number;
  /** Número de intentos a realizar si la petición falla por error de servidor o red. */
  max_retries?: number;
}

/**
 * Clase principal cliente. Implementa un patrón de diseño orientado a objetos
 * para mantener la modularidad y permitir múltiples instancias con distintas configuraciones.
 */
export class SmartFetchClient {
  private default_config: FetchOptions;

  /**
   * @param default_config - Opciones por defecto (Patrón de diseño Factory/Builder implícito).
   */
  constructor(default_config: FetchOptions = {}) {
    this.default_config = default_config;
  }

  /**
   * Método base para realizar peticiones.
   */
  public async request(url_path: string, options: FetchOptions = {}): Promise<Response> {
    const final_options = { ...this.default_config, ...options };
    const { timeout_ms, max_retries = 0, ...fetch_options } = final_options;
    
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

  /** Alias para método GET */
  public async get(url_path: string, options: FetchOptions = {}): Promise<Response> {
    return this.request(url_path, { ...options, method: 'GET' });
  }

  /** Alias para método POST */
  public async post(url_path: string, payload_data: any, options: FetchOptions = {}): Promise<Response> {
    return this.request(url_path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(payload_data),
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
  }

  /** Alias para método PUT */
  public async put(url_path: string, payload_data: any, options: FetchOptions = {}): Promise<Response> {
    return this.request(url_path, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(payload_data),
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
  }

  /** Alias para método PATCH */
  public async patch(url_path: string, payload_data: any, options: FetchOptions = {}): Promise<Response> {
    return this.request(url_path, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(payload_data),
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
  }

  /** Alias para método DELETE */
  public async delete(url_path: string, options: FetchOptions = {}): Promise<Response> {
    return this.request(url_path, { ...options, method: 'DELETE' });
  }

  /** Patrón Factory: Crea una nueva instancia con configuración independiente */
  public create(custom_config: FetchOptions): SmartFetchClient {
    return new SmartFetchClient({ ...this.default_config, ...custom_config });
  }
}

// Patrón Singleton: Exportamos una instancia única por defecto (al estilo Axios)
export const smart_fetch = new SmartFetchClient();
