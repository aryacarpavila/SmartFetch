/**
 * Opciones para la configuración de peticiones.
 */
export interface FetchOptions extends RequestInit {
  timeout_ms?: number;
  max_retries?: number;
}

/**
 * Error controlado para cuando una petición excede el tiempo de espera configurado.
 */
export class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`La petición fue cancelada porque excedió el tiempo límite de ${timeout}ms.`);
    this.name = 'TimeoutError';
  }
}

/**
 * Tipos para los interceptores (Programación Orientada a Aspectos)
 */
export type RequestInterceptor = (config: FetchOptions) => FetchOptions | Promise<FetchOptions>;
export type ResponseInterceptor = (response: Response) => Response | Promise<Response>;

/**
 * Clase principal cliente. Implementa un patrón de diseño orientado a objetos
 * para mantener la modularidad y permitir múltiples instancias.
 */
export class SmartFetchClient {
  private default_config: FetchOptions;
  
  // Aspectos: Interceptores de petición y respuesta
  private request_interceptors: RequestInterceptor[] = [];
  private response_interceptors: ResponseInterceptor[] = [];

  constructor(default_config: FetchOptions = {}) {
    this.default_config = default_config;
  }

  /** Permite agregar un interceptor que se ejecuta antes de cada peticion */
  public add_request_interceptor(interceptor: RequestInterceptor): void {
    this.request_interceptors.push(interceptor);
  }

  /** Permite agregar un interceptor que se ejecuta despues de cada peticion exitosa */
  public add_response_interceptor(interceptor: ResponseInterceptor): void {
    this.response_interceptors.push(interceptor);
  }

  /**
   * Método base para realizar peticiones.
   */
  public async request(url_path: string, options: FetchOptions = {}): Promise<Response> {
    let final_options = { ...this.default_config, ...options };
    
    // Ejecutar interceptores de peticion (AOP)
    for (const interceptor of this.request_interceptors) {
      final_options = await interceptor(final_options);
    }

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

        let response = await fetch(url_path, {
          ...fetch_options,
          signal,
        });

        if (timeout_id) {
          clearTimeout(timeout_id);
        }

        if (response.status >= 500 && response.status < 600) {
          throw new Error(`Error del servidor. Código de estado: ${response.status}`);
        }

        // Ejecutar interceptores de respuesta (AOP)
        for (const interceptor of this.response_interceptors) {
          response = await interceptor(response);
        }

        return response;
      } catch (error: any) {
        if (error.name === 'AbortError' && timeout_ms) {
          last_error = new TimeoutError(timeout_ms);
        } else {
          last_error = error;
        }
        current_attempt++;
      }
    }

    throw last_error;
  }

  public async get(url_path: string, options: FetchOptions = {}): Promise<Response> {
    return this.request(url_path, { ...options, method: 'GET' });
  }

  public async post(url_path: string, payload_data: any, options: FetchOptions = {}): Promise<Response> {
    return this.request(url_path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(payload_data),
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
  }

  public async put(url_path: string, payload_data: any, options: FetchOptions = {}): Promise<Response> {
    return this.request(url_path, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(payload_data),
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
  }

  public async patch(url_path: string, payload_data: any, options: FetchOptions = {}): Promise<Response> {
    return this.request(url_path, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(payload_data),
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
  }

  public async delete(url_path: string, options: FetchOptions = {}): Promise<Response> {
    return this.request(url_path, { ...options, method: 'DELETE' });
  }

  public create(custom_config: FetchOptions): SmartFetchClient {
    return new SmartFetchClient({ ...this.default_config, ...custom_config });
  }
}

export const smart_fetch = new SmartFetchClient();
