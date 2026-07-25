import { SmartFetchOptions } from '../types/smart-fetch-options';

/**
 * Identificador utilizado para retirar un interceptor registrado.
 */
export type InterceptorId = number;

/**
 * Aspecto ejecutado antes de comenzar una petición.
 */
export type RequestInterceptor = (
  config: SmartFetchOptions,
) => SmartFetchOptions | Promise<SmartFetchOptions>;

/**
 * Aspecto ejecutado después de recibir una respuesta exitosa.
 */
export type ResponseInterceptor = (
  response: Response,
) => Response | Promise<Response>;
