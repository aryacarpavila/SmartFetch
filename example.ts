import { smartFetch } from './src/index';

/**
 * Ejecuta un ejemplo de GET con timeout, reintentos e interceptores.
 */
async function runExample(): Promise<void> {
  smartFetch.addRequestInterceptor((config) => {
    console.log('[Interceptor] Agregando autorización a la petición');
    const headers = new Headers(config.headers);
    headers.set('Authorization', 'Bearer MI_TOKEN_SECRETO');

    return { ...config, headers };
  });

  smartFetch.addResponseInterceptor((response) => {
    console.log('[Interceptor] Respuesta recibida:', response.status);
    return response;
  });

  try {
    const response = await smartFetch.get(
      'https://jsonplaceholder.typicode.com/posts/1',
      {
        timeoutMs: 2_000,
        maxRetries: 3,
      },
    );

    if (!response.ok) {
      console.error('La API respondió con el estado:', response.status);
      return;
    }

    const data: unknown = await response.json();
    console.log('Datos obtenidos:', data);
  } catch (error: unknown) {
    console.error('La petición falló definitivamente:', error);
  }
}

void runExample();
