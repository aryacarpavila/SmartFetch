import {
  SmartFetchClient,
  SmartFetchOptions,
  smartFetch,
} from '../src/index';

const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;

/**
 * Crea un cliente cuya comunicación queda controlada por el mock de pruebas.
 *
 * @param defaultConfig - Configuración predeterminada del cliente.
 * @returns Cliente aislado para cada escenario.
 */
function createClient(
  defaultConfig: SmartFetchOptions = {},
): SmartFetchClient {
  return new SmartFetchClient(defaultConfig, {
    fetchImplementation: fetchMock,
  });
}

describe('SmartFetchClient - API pública', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('Correcto', { status: 200 }));
  });

  it('expone una instancia compartida sin afirmar que es un Singleton', () => {
    expect(smartFetch).toBeInstanceOf(SmartFetchClient);
  });

  it.each([
    ['get', 'GET'],
    ['delete', 'DELETE'],
  ] as const)(
    'ejecuta %s utilizando el método %s',
    async (methodName, expectedMethod) => {
      const client = createClient();

      await client[methodName]('https://api.ejemplo.com/resources', {
        method: 'OPTIONS',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][1]?.method).toBe(expectedMethod);
    },
  );

  it.each([
    ['post', 'POST'],
    ['put', 'PUT'],
    ['patch', 'PATCH'],
  ] as const)(
    'ejecuta %s con payload JSON y método %s',
    async (methodName, expectedMethod) => {
      const client = createClient();
      const payload = { name: 'SmartFetch', active: true };

      await client[methodName](
        'https://api.ejemplo.com/resources',
        payload,
      );

      const requestOptions = fetchMock.mock.calls[0][1];
      const headers = new Headers(requestOptions?.headers);

      expect(requestOptions?.method).toBe(expectedMethod);
      expect(requestOptions?.body).toBe(JSON.stringify(payload));
      expect(headers.get('content-type')).toBe('application/json');
    },
  );

  it('combina headers predeterminados y específicos sin distinguir mayúsculas', async () => {
    const client = createClient({
      headers: {
        Authorization: 'Bearer default',
        'X-Shared': 'default',
      },
    });

    await client.get('https://api.ejemplo.com/resources', {
      headers: {
        'x-shared': 'request',
        'X-Request': 'present',
      },
    });

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);

    expect(headers.get('authorization')).toBe('Bearer default');
    expect(headers.get('x-shared')).toBe('request');
    expect(headers.get('x-request')).toBe('present');
  });

  it('permite reemplazar el Content-Type automático', async () => {
    const client = createClient();

    await client.post(
      'https://api.ejemplo.com/resources',
      { problem: true },
      {
        headers: {
          'content-type': 'application/problem+json',
        },
      },
    );

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('content-type')).toBe('application/problem+json');
  });

  it('ejecuta interceptores de petición en el orden de registro', async () => {
    const client = createClient();
    const executionOrder: string[] = [];

    client.addRequestInterceptor((config) => {
      executionOrder.push('first');
      const headers = new Headers(config.headers);
      headers.set('Authorization', 'Bearer test');
      return { ...config, headers };
    });
    client.addRequestInterceptor(async (config) => {
      executionOrder.push('second');
      return config;
    });

    await client.get('https://api.ejemplo.com/resources');

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(executionOrder).toEqual(['first', 'second']);
    expect(headers.get('authorization')).toBe('Bearer test');
  });

  it('ejecuta interceptores de respuesta en el orden de registro', async () => {
    const client = createClient();

    client.addResponseInterceptor((response) => {
      return new Response(`${response.status}:first`, { status: 200 });
    });
    client.addResponseInterceptor(async (response) => {
      return new Response(`${await response.text()}:second`, {
        status: 200,
      });
    });

    const response = await client.get(
      'https://api.ejemplo.com/resources',
    );

    expect(await response.text()).toBe('200:first:second');
  });

  it('permite retirar interceptores mediante su identificador', async () => {
    const client = createClient();
    const requestInterceptor = jest.fn((config: SmartFetchOptions) => config);
    const responseInterceptor = jest.fn((response: Response) => response);
    const requestId = client.addRequestInterceptor(requestInterceptor);
    const responseId = client.addResponseInterceptor(responseInterceptor);

    expect(client.removeRequestInterceptor(requestId)).toBe(true);
    expect(client.removeRequestInterceptor(requestId)).toBe(false);
    expect(client.removeResponseInterceptor(responseId)).toBe(true);
    expect(client.removeResponseInterceptor(responseId)).toBe(false);

    await client.get('https://api.ejemplo.com/resources');

    expect(requestInterceptor).not.toHaveBeenCalled();
    expect(responseInterceptor).not.toHaveBeenCalled();
  });

  it('crea clientes independientes conservando configuración y dependencias', async () => {
    const baseClient = createClient({
      headers: { Authorization: 'Bearer inherited' },
    });
    const interceptor = jest.fn((config: SmartFetchOptions) => config);
    baseClient.addRequestInterceptor(interceptor);

    const customClient = baseClient.create({
      headers: { 'X-Custom': 'child' },
    });
    await customClient.get('https://api.ejemplo.com/resources');

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('authorization')).toBe('Bearer inherited');
    expect(headers.get('x-custom')).toBe('child');
    expect(interceptor).not.toHaveBeenCalled();
  });
});
