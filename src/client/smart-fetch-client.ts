import { ConfigurationError } from '../errors/configuration-error';
import { HttpError } from '../errors/http-error';
import { TimeoutError } from '../errors/timeout-error';
import {
  InterceptorId,
  RequestInterceptor,
  ResponseInterceptor,
} from '../interceptors/interceptor';
import {
  DefaultRetryPolicy,
  RetryContext,
  RetryPolicy,
} from '../retry/retry-policy';
import {
  FetchInput,
  SmartFetchOptions,
} from '../types/smart-fetch-options';
import { mergeHeaders } from '../utils/headers';

/**
 * Dependencias reemplazables del cliente.
 */
export interface SmartFetchDependencies {
  /** Estrategia utilizada para decidir y temporizar los reintentos. */
  retryPolicy?: RetryPolicy;

  /** Implementación de fetch, útil para pruebas y entornos personalizados. */
  fetchImplementation?: typeof fetch;
}

/**
 * Métodos HTTP que serializan automáticamente un payload JSON.
 */
type JsonHttpMethod = 'POST' | 'PUT' | 'PATCH';

/**
 * Cliente HTTP que actúa como fachada sobre la API nativa `fetch`.
 */
export class SmartFetchClient {
  private readonly defaultConfig: SmartFetchOptions;
  private readonly retryPolicy: RetryPolicy;
  private readonly fetchImplementation?: typeof fetch;
  private readonly requestInterceptors = new Map<
    InterceptorId,
    RequestInterceptor
  >();
  private readonly responseInterceptors = new Map<
    InterceptorId,
    ResponseInterceptor
  >();
  private nextInterceptorId = 0;

  /**
   * Crea un cliente SmartFetch.
   *
   * @param defaultConfig - Configuración aplicada a todas las peticiones.
   * @param dependencies - Dependencias que pueden reemplazarse.
   */
  public constructor(
    defaultConfig: SmartFetchOptions = {},
    dependencies: SmartFetchDependencies = {},
  ) {
    this.defaultConfig = this.mergeOptions({}, defaultConfig);
    this.retryPolicy = dependencies.retryPolicy ?? new DefaultRetryPolicy();
    this.fetchImplementation = dependencies.fetchImplementation;
  }

  /**
   * Registra un interceptor ejecutado antes de cada petición.
   *
   * @param interceptor - Función que recibe y devuelve la configuración.
   * @returns Identificador que permite retirar el interceptor.
   */
  public addRequestInterceptor(
    interceptor: RequestInterceptor,
  ): InterceptorId {
    const interceptorId = this.nextInterceptorId++;
    this.requestInterceptors.set(interceptorId, interceptor);
    return interceptorId;
  }

  /**
   * Retira un interceptor de petición.
   *
   * @param interceptorId - Identificador devuelto durante el registro.
   * @returns `true` cuando el interceptor existía.
   */
  public removeRequestInterceptor(interceptorId: InterceptorId): boolean {
    return this.requestInterceptors.delete(interceptorId);
  }

  /**
   * Registra un interceptor ejecutado sobre cada respuesta exitosa.
   *
   * @param interceptor - Función que recibe y devuelve la respuesta.
   * @returns Identificador que permite retirar el interceptor.
   */
  public addResponseInterceptor(
    interceptor: ResponseInterceptor,
  ): InterceptorId {
    const interceptorId = this.nextInterceptorId++;
    this.responseInterceptors.set(interceptorId, interceptor);
    return interceptorId;
  }

  /**
   * Retira un interceptor de respuesta.
   *
   * @param interceptorId - Identificador devuelto durante el registro.
   * @returns `true` cuando el interceptor existía.
   */
  public removeResponseInterceptor(interceptorId: InterceptorId): boolean {
    return this.responseInterceptors.delete(interceptorId);
  }

  /**
   * Realiza una petición utilizando cualquier método soportado por fetch.
   *
   * @param input - URL, cadena o Request que identifica el recurso.
   * @param options - Configuración específica de la petición.
   * @returns Respuesta HTTP obtenida.
   */
  public async request(
    input: FetchInput,
    options: SmartFetchOptions = {},
  ): Promise<Response> {
    let finalOptions = this.mergeOptions(this.defaultConfig, options);

    for (const interceptor of this.requestInterceptors.values()) {
      finalOptions = await interceptor(finalOptions);
    }

    const {
      timeoutMs,
      maxRetries = 0,
      ...fetchOptions
    } = finalOptions;
    this.validateConfig(timeoutMs, maxRetries);

    for (
      let currentAttempt = 0;
      currentAttempt <= maxRetries;
      currentAttempt++
    ) {
      let response: Response;

      try {
        response = await this.executeFetch(input, fetchOptions, timeoutMs);
      } catch (error: unknown) {
        const retryContext: RetryContext = {
          attempt: currentAttempt,
          error,
        };

        if (
          fetchOptions.signal?.aborted
          || !this.canRetry(currentAttempt, maxRetries, retryContext)
        ) {
          throw error;
        }

        await this.waitBeforeRetry(retryContext, fetchOptions.signal);
        continue;
      }

      if (response.status >= 500 && response.status <= 599) {
        const serverError = new HttpError(response);
        const retryContext: RetryContext = {
          attempt: currentAttempt,
          error: serverError,
          response,
        };

        if (!this.canRetry(currentAttempt, maxRetries, retryContext)) {
          throw serverError;
        }

        await this.waitBeforeRetry(retryContext, fetchOptions.signal);
        continue;
      }

      for (const interceptor of this.responseInterceptors.values()) {
        response = await interceptor(response);
      }

      return response;
    }

    throw new Error('SmartFetch alcanzó un estado de reintentos inesperado.');
  }

  /**
   * Realiza una petición GET.
   *
   * @param input - Recurso solicitado.
   * @param options - Configuración específica de la petición.
   * @returns Respuesta HTTP obtenida.
   */
  public get(
    input: FetchInput,
    options: SmartFetchOptions = {},
  ): Promise<Response> {
    return this.request(input, { ...options, method: 'GET' });
  }

  /**
   * Realiza una petición POST con un payload JSON.
   *
   * @param input - Recurso solicitado.
   * @param payload - Valor serializable enviado en el cuerpo.
   * @param options - Configuración específica de la petición.
   * @returns Respuesta HTTP obtenida.
   */
  public post(
    input: FetchInput,
    payload: unknown,
    options: SmartFetchOptions = {},
  ): Promise<Response> {
    return this.requestJson('POST', input, payload, options);
  }

  /**
   * Realiza una petición PUT con un payload JSON.
   *
   * @param input - Recurso solicitado.
   * @param payload - Valor serializable enviado en el cuerpo.
   * @param options - Configuración específica de la petición.
   * @returns Respuesta HTTP obtenida.
   */
  public put(
    input: FetchInput,
    payload: unknown,
    options: SmartFetchOptions = {},
  ): Promise<Response> {
    return this.requestJson('PUT', input, payload, options);
  }

  /**
   * Realiza una petición PATCH con un payload JSON.
   *
   * @param input - Recurso solicitado.
   * @param payload - Valor serializable enviado en el cuerpo.
   * @param options - Configuración específica de la petición.
   * @returns Respuesta HTTP obtenida.
   */
  public patch(
    input: FetchInput,
    payload: unknown,
    options: SmartFetchOptions = {},
  ): Promise<Response> {
    return this.requestJson('PATCH', input, payload, options);
  }

  /**
   * Realiza una petición DELETE.
   *
   * @param input - Recurso solicitado.
   * @param options - Configuración específica de la petición.
   * @returns Respuesta HTTP obtenida.
   */
  public delete(
    input: FetchInput,
    options: SmartFetchOptions = {},
  ): Promise<Response> {
    return this.request(input, { ...options, method: 'DELETE' });
  }

  /**
   * Crea un cliente independiente combinando configuración nueva y existente.
   *
   * @param customConfig - Configuración que reemplaza los valores actuales.
   * @returns Nueva instancia sin compartir interceptores.
   */
  public create(customConfig: SmartFetchOptions): SmartFetchClient {
    return new SmartFetchClient(
      this.mergeOptions(this.defaultConfig, customConfig),
      {
        retryPolicy: this.retryPolicy,
        fetchImplementation: this.fetchImplementation,
      },
    );
  }

  /**
   * Ejecuta un método HTTP que serializa su payload como JSON.
   *
   * @param method - Método HTTP utilizado.
   * @param input - Recurso solicitado.
   * @param payload - Valor serializable enviado en el cuerpo.
   * @param options - Configuración específica de la petición.
   * @returns Respuesta HTTP obtenida.
   */
  private requestJson(
    method: JsonHttpMethod,
    input: FetchInput,
    payload: unknown,
    options: SmartFetchOptions,
  ): Promise<Response> {
    return this.request(input, {
      ...options,
      method,
      body: JSON.stringify(payload),
      headers: mergeHeaders(
        { 'Content-Type': 'application/json' },
        options.headers,
      ),
    });
  }

  /**
   * Combina opciones sin perder headers predeterminados.
   *
   * @param baseOptions - Configuración de menor precedencia.
   * @param overridingOptions - Configuración de mayor precedencia.
   * @returns Nueva configuración independiente.
   */
  private mergeOptions(
    baseOptions: SmartFetchOptions,
    overridingOptions: SmartFetchOptions,
  ): SmartFetchOptions {
    return {
      ...baseOptions,
      ...overridingOptions,
      headers: mergeHeaders(
        baseOptions.headers,
        overridingOptions.headers,
      ),
    };
  }

  /**
   * Ejecuta un único intento y coordina timeout y señal externa.
   *
   * @param input - Recurso solicitado.
   * @param fetchOptions - Opciones nativas de fetch.
   * @param timeoutMs - Tiempo máximo del intento.
   * @returns Respuesta producida por fetch.
   */
  private async executeFetch(
    input: FetchInput,
    fetchOptions: RequestInit,
    timeoutMs?: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const externalSignal = fetchOptions.signal;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let didTimeout = false;

    if (externalSignal?.aborted) {
      throw this.getAbortError(externalSignal);
    }

    const abortFromExternalSignal = (): void => {
      controller.abort(externalSignal?.reason);
    };

    externalSignal?.addEventListener('abort', abortFromExternalSignal, {
      once: true,
    });

    if (timeoutMs !== undefined) {
      timeoutId = setTimeout(() => {
        didTimeout = true;
        controller.abort();
      }, timeoutMs);
    }

    try {
      const selectedFetch = this.fetchImplementation ?? globalThis.fetch;
      return await selectedFetch(input, {
        ...fetchOptions,
        signal: controller.signal,
      });
    } catch (error: unknown) {
      if (didTimeout && timeoutMs !== undefined) {
        throw new TimeoutError(timeoutMs);
      }

      throw error;
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }

      externalSignal?.removeEventListener(
        'abort',
        abortFromExternalSignal,
      );
    }
  }

  /**
   * Verifica si todavía quedan intentos y la estrategia admite el fallo.
   *
   * @param currentAttempt - Índice del intento fallido.
   * @param maxRetries - Número máximo de reintentos adicionales.
   * @param context - Información del fallo.
   * @returns `true` cuando debe realizarse otro intento.
   */
  private canRetry(
    currentAttempt: number,
    maxRetries: number,
    context: RetryContext,
  ): boolean {
    return (
      currentAttempt < maxRetries
      && this.retryPolicy.shouldRetry(context)
    );
  }

  /**
   * Espera el tiempo indicado por la estrategia antes de reintentar.
   *
   * @param context - Información del intento fallido.
   * @param signal - Señal externa que también puede cancelar la espera.
   */
  private async waitBeforeRetry(
    context: RetryContext,
    signal?: AbortSignal | null,
  ): Promise<void> {
    const delayMs = this.retryPolicy.getDelayMs(context);

    if (!Number.isFinite(delayMs) || delayMs < 0) {
      throw new ConfigurationError(
        'La política de reintentos debe producir una espera finita y no negativa.',
      );
    }

    if (signal?.aborted) {
      throw this.getAbortError(signal);
    }

    if (delayMs === 0) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout>;
      const abortWait = (): void => {
        clearTimeout(timeoutId);
        signal?.removeEventListener('abort', abortWait);

        if (signal !== undefined && signal !== null) {
          reject(this.getAbortError(signal));
        }
      };
      const finishWait = (): void => {
        signal?.removeEventListener('abort', abortWait);
        resolve();
      };

      timeoutId = setTimeout(finishWait, delayMs);
      signal?.addEventListener('abort', abortWait, { once: true });
    });
  }

  /**
   * Normaliza el motivo de una cancelación externa.
   *
   * @param signal - Señal cancelada.
   * @returns Motivo original o un `AbortError` estándar.
   */
  private getAbortError(signal: AbortSignal): Error {
    return signal.reason instanceof Error
      ? signal.reason
      : new DOMException('La petición fue cancelada.', 'AbortError');
  }

  /**
   * Valida los valores que controlan timeout e intentos.
   *
   * @param timeoutMs - Tiempo máximo configurado.
   * @param maxRetries - Número de reintentos adicionales.
   */
  private validateConfig(
    timeoutMs: number | undefined,
    maxRetries: number,
  ): void {
    if (
      timeoutMs !== undefined
      && (
        !Number.isFinite(timeoutMs)
        || !Number.isInteger(timeoutMs)
        || timeoutMs <= 0
      )
    ) {
      throw new ConfigurationError(
        'timeoutMs debe ser un entero positivo expresado en milisegundos.',
      );
    }

    if (
      !Number.isFinite(maxRetries)
      || !Number.isInteger(maxRetries)
      || maxRetries < 0
    ) {
      throw new ConfigurationError(
        'maxRetries debe ser un entero mayor o igual que cero.',
      );
    }
  }
}
