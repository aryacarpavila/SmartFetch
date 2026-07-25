import { ConfigurationError } from './errors/configuration-error';
import { HttpError } from './errors/http-error';
import { TimeoutError } from './errors/timeout-error';
import {
  DefaultRetryPolicy,
  RetryContext,
  RetryPolicy,
} from './retry/retry-policy';

export { ConfigurationError, HttpError, TimeoutError };
export { DefaultRetryPolicy };
export type { RetryContext, RetryPolicy };

/**
 * Opciones para la configuración de peticiones.
 */
export interface FetchOptions extends RequestInit {
  /** Tiempo máximo permitido para cada intento, en milisegundos. */
  timeout_ms?: number;
  /** Cantidad de reintentos adicionales; cero equivale a un único intento. */
  max_retries?: number;
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
  private readonly retry_policy: RetryPolicy;
  
  // Aspectos: Interceptores de petición y respuesta
  private request_interceptors: RequestInterceptor[] = [];
  private response_interceptors: ResponseInterceptor[] = [];

  /**
   * Crea un cliente SmartFetch.
   *
   * @param default_config - Configuración aplicada a todas las peticiones.
   * @param retry_policy - Estrategia que decide qué fallos deben reintentarse.
   */
  constructor(
    default_config: FetchOptions = {},
    retry_policy: RetryPolicy = new DefaultRetryPolicy(),
  ) {
    this.default_config = default_config;
    this.retry_policy = retry_policy;
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
    this.validate_config(timeout_ms, max_retries);

    for (let current_attempt = 0; current_attempt <= max_retries; current_attempt++) {
      let response: Response;

      try {
        response = await this.execute_fetch(url_path, fetch_options, timeout_ms);
      } catch (error: unknown) {
        const retry_context: RetryContext = {
          attempt: current_attempt,
          error,
        };

        if (
          fetch_options.signal?.aborted
          || !this.can_retry(current_attempt, max_retries, retry_context)
        ) {
          throw error;
        }

        await this.wait_before_retry(
          retry_context,
          fetch_options.signal,
        );
        continue;
      }

      if (response.status >= 500 && response.status <= 599) {
        const server_error = new HttpError(response);
        const retry_context: RetryContext = {
          attempt: current_attempt,
          error: server_error,
          response,
        };

        if (!this.can_retry(current_attempt, max_retries, retry_context)) {
          throw server_error;
        }

        await this.wait_before_retry(
          retry_context,
          fetch_options.signal,
        );
        continue;
      }

      // Ejecutar interceptores de respuesta (AOP) fuera del ciclo de reintentos.
      for (const interceptor of this.response_interceptors) {
        response = await interceptor(response);
      }

      return response;
    }

    throw new Error('SmartFetch alcanzó un estado de reintentos inesperado.');
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
    return new SmartFetchClient(
      { ...this.default_config, ...custom_config },
      this.retry_policy,
    );
  }

  /**
   * Ejecuta un único intento y coordina el timeout con una señal externa.
   *
   * @param url_path - URL de la petición.
   * @param fetch_options - Opciones nativas de fetch.
   * @param timeout_ms - Tiempo máximo del intento.
   * @returns Respuesta producida por fetch.
   */
  private async execute_fetch(
    url_path: string,
    fetch_options: RequestInit,
    timeout_ms?: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const external_signal = fetch_options.signal;
    let timeout_id: ReturnType<typeof setTimeout> | undefined;
    let did_timeout = false;

    if (external_signal?.aborted) {
      throw this.get_abort_error(external_signal);
    }

    const abort_from_external_signal = (): void => {
      controller.abort(external_signal?.reason);
    };

    external_signal?.addEventListener('abort', abort_from_external_signal, {
      once: true,
    });

    if (timeout_ms !== undefined) {
      timeout_id = setTimeout(() => {
        did_timeout = true;
        controller.abort();
      }, timeout_ms);
    }

    try {
      return await fetch(url_path, {
        ...fetch_options,
        signal: controller.signal,
      });
    } catch (error: unknown) {
      if (did_timeout && timeout_ms !== undefined) {
        throw new TimeoutError(timeout_ms);
      }

      throw error;
    } finally {
      if (timeout_id !== undefined) {
        clearTimeout(timeout_id);
      }

      external_signal?.removeEventListener(
        'abort',
        abort_from_external_signal,
      );
    }
  }

  /**
   * Verifica si todavía quedan intentos y la estrategia admite el fallo.
   *
   * @param current_attempt - Índice del intento fallido.
   * @param max_retries - Número máximo de reintentos adicionales.
   * @param context - Información del fallo.
   * @returns `true` cuando debe realizarse otro intento.
   */
  private can_retry(
    current_attempt: number,
    max_retries: number,
    context: RetryContext,
  ): boolean {
    return (
      current_attempt < max_retries
      && this.retry_policy.should_retry(context)
    );
  }

  /**
   * Espera el tiempo indicado por la estrategia antes de reintentar.
   *
   * @param context - Información del intento fallido.
   * @param signal - Señal externa que puede cancelar también la espera.
   */
  private async wait_before_retry(
    context: RetryContext,
    signal?: AbortSignal | null,
  ): Promise<void> {
    const delay_ms = this.retry_policy.get_delay_ms(context);

    if (!Number.isFinite(delay_ms) || delay_ms < 0) {
      throw new ConfigurationError(
        'La política de reintentos debe producir una espera finita y no negativa.',
      );
    }

    if (signal?.aborted) {
      throw this.get_abort_error(signal);
    }

    if (delay_ms === 0) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let timeout_id: ReturnType<typeof setTimeout>;
      const abort_wait = (): void => {
        clearTimeout(timeout_id);
        signal?.removeEventListener('abort', abort_wait);

        if (signal !== undefined && signal !== null) {
          reject(this.get_abort_error(signal));
        }
      };
      const finish_wait = (): void => {
        signal?.removeEventListener('abort', abort_wait);
        resolve();
      };

      timeout_id = setTimeout(finish_wait, delay_ms);
      signal?.addEventListener('abort', abort_wait, { once: true });
    });
  }

  /**
   * Normaliza el motivo de una cancelación externa como una instancia de Error.
   *
   * @param signal - Señal que ya fue cancelada.
   * @returns Motivo original o un `AbortError` estándar.
   */
  private get_abort_error(signal: AbortSignal): Error {
    return signal.reason instanceof Error
      ? signal.reason
      : new DOMException('La petición fue cancelada.', 'AbortError');
  }

  /**
   * Valida los valores que controlan timeout e intentos.
   *
   * @param timeout_ms - Tiempo máximo configurado.
   * @param max_retries - Número de reintentos adicionales.
   */
  private validate_config(
    timeout_ms: number | undefined,
    max_retries: number,
  ): void {
    if (
      timeout_ms !== undefined
      && (
        !Number.isFinite(timeout_ms)
        || !Number.isInteger(timeout_ms)
        || timeout_ms <= 0
      )
    ) {
      throw new ConfigurationError(
        'timeout_ms debe ser un entero positivo expresado en milisegundos.',
      );
    }

    if (
      !Number.isFinite(max_retries)
      || !Number.isInteger(max_retries)
      || max_retries < 0
    ) {
      throw new ConfigurationError(
        'max_retries debe ser un entero mayor o igual que cero.',
      );
    }
  }
}

export const smart_fetch = new SmartFetchClient();
