import { SmartFetchClient } from './client/smart-fetch-client';

export {
  SmartFetchClient,
} from './client/smart-fetch-client';
export type {
  SmartFetchDependencies,
} from './client/smart-fetch-client';
export { ConfigurationError } from './errors/configuration-error';
export { HttpError } from './errors/http-error';
export { TimeoutError } from './errors/timeout-error';
export type {
  InterceptorId,
  RequestInterceptor,
  ResponseInterceptor,
} from './interceptors/interceptor';
export { DefaultRetryPolicy } from './retry/retry-policy';
export type {
  RetryContext,
  RetryPolicy,
} from './retry/retry-policy';
export type {
  FetchInput,
  SmartFetchOptions,
} from './types/smart-fetch-options';

/**
 * Instancia compartida para el uso directo de SmartFetch.
 */
export const smartFetch = new SmartFetchClient();
