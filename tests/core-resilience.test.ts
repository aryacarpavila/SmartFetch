import {
  ConfigurationError,
  HttpError,
  RetryPolicy,
  SmartFetchClient,
  TimeoutError,
} from '../src/index';

global.fetch = jest.fn() as jest.Mock;

const fetch_mock = global.fetch as jest.MockedFunction<typeof fetch>;

/**
 * Simula una petición pendiente que solo termina cuando recibe una cancelación.
 *
 * @param _input - Recurso solicitado; no se utiliza en este mock.
 * @param init - Opciones que contienen la señal de cancelación.
 * @returns Promesa que rechaza con `AbortError` cuando la señal es abortada.
 */
function create_abortable_pending_response(
  _input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;

    if (signal?.aborted) {
      reject(new DOMException('La petición fue cancelada.', 'AbortError'));
      return;
    }

    signal?.addEventListener(
      'abort',
      () => reject(new DOMException('La petición fue cancelada.', 'AbortError')),
      { once: true },
    );
  });
}

describe('SmartFetchClient - resiliencia', () => {
  beforeEach(() => {
    fetch_mock.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('realiza un único intento por defecto ante un error 5xx', async () => {
    fetch_mock.mockResolvedValue(
      new Response('Error interno', { status: 500 }),
    );

    await expect(
      new SmartFetchClient().get('https://api.ejemplo.com/data'),
    ).rejects.toMatchObject({
      name: 'HttpError',
      status: 500,
    });

    expect(fetch_mock).toHaveBeenCalledTimes(1);
  });

  it('reintenta una respuesta 5xx hasta obtener una respuesta exitosa', async () => {
    fetch_mock
      .mockResolvedValueOnce(new Response('Error temporal', { status: 503 }))
      .mockResolvedValueOnce(new Response('Recuperado', { status: 200 }));

    const response = await new SmartFetchClient().get(
      'https://api.ejemplo.com/data',
      { maxRetries: 2 },
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Recuperado');
    expect(fetch_mock).toHaveBeenCalledTimes(2);
  });

  it('agota exactamente el número de reintentos configurado', async () => {
    fetch_mock.mockResolvedValue(
      new Response('Error interno', { status: 500 }),
    );

    await expect(
      new SmartFetchClient().get(
        'https://api.ejemplo.com/data',
        { maxRetries: 2 },
      ),
    ).rejects.toBeInstanceOf(HttpError);

    expect(fetch_mock).toHaveBeenCalledTimes(3);
  });

  it('reintenta errores de red y conserva la respuesta recuperada', async () => {
    fetch_mock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response('Disponible', { status: 200 }));

    const response = await new SmartFetchClient().get(
      'https://api.ejemplo.com/data',
      { maxRetries: 1 },
    );

    expect(await response.text()).toBe('Disponible');
    expect(fetch_mock).toHaveBeenCalledTimes(2);
  });

  it('devuelve respuestas 4xx sin reintentarlas', async () => {
    fetch_mock.mockResolvedValue(
      new Response('No encontrado', { status: 404 }),
    );

    const response = await new SmartFetchClient().get(
      'https://api.ejemplo.com/data',
      { maxRetries: 3 },
    );

    expect(response.status).toBe(404);
    expect(fetch_mock).toHaveBeenCalledTimes(1);
  });

  it('convierte una cancelación por tiempo en TimeoutError', async () => {
    jest.useFakeTimers();
    fetch_mock.mockImplementation(create_abortable_pending_response);

    const request = new SmartFetchClient().get(
      'https://api.ejemplo.com/lento',
      { timeoutMs: 100 },
    );
    const expected_rejection = expect(request).rejects.toMatchObject({
      name: 'TimeoutError',
      timeoutMs: 100,
    });

    await jest.advanceTimersByTimeAsync(100);
    await expected_rejection;

    expect(fetch_mock).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('limpia el temporizador cuando la petición termina antes del timeout', async () => {
    jest.useFakeTimers();
    fetch_mock.mockResolvedValue(new Response('Rápido', { status: 200 }));

    const response = await new SmartFetchClient().get(
      'https://api.ejemplo.com/rapido',
      { timeoutMs: 1_000 },
    );

    expect(response.status).toBe(200);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('respeta una señal externa y no reintenta la cancelación del usuario', async () => {
    fetch_mock.mockImplementation(create_abortable_pending_response);
    const controller = new AbortController();

    const request = new SmartFetchClient().get(
      'https://api.ejemplo.com/data',
      {
        maxRetries: 3,
        signal: controller.signal,
      },
    );

    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch_mock).toHaveBeenCalledTimes(1);
  });

  it('no inicia fetch cuando recibe una señal previamente cancelada', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      new SmartFetchClient().get(
        'https://api.ejemplo.com/data',
        {
          maxRetries: 3,
          signal: controller.signal,
        },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(fetch_mock).not.toHaveBeenCalled();
  });

  it('no reintenta errores producidos por un interceptor de respuesta', async () => {
    fetch_mock.mockResolvedValue(new Response('Correcto', { status: 200 }));
    const client = new SmartFetchClient({ maxRetries: 3 });

    client.addResponseInterceptor(() => {
      throw new Error('Falló el interceptor');
    });

    await expect(
      client.get('https://api.ejemplo.com/data'),
    ).rejects.toThrow('Falló el interceptor');

    expect(fetch_mock).toHaveBeenCalledTimes(1);
  });

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY])(
    'rechaza el timeout inválido %s',
    async (timeoutMs) => {
      await expect(
        new SmartFetchClient().get(
          'https://api.ejemplo.com/data',
          { timeoutMs },
        ),
      ).rejects.toBeInstanceOf(ConfigurationError);

      expect(fetch_mock).not.toHaveBeenCalled();
    },
  );

  it.each([-1, 1.5, Number.POSITIVE_INFINITY])(
    'rechaza la cantidad de reintentos inválida %s',
    async (maxRetries) => {
      await expect(
        new SmartFetchClient().get(
          'https://api.ejemplo.com/data',
          { maxRetries },
        ),
      ).rejects.toBeInstanceOf(ConfigurationError);

      expect(fetch_mock).not.toHaveBeenCalled();
    },
  );

  it('aplica la espera indicada por una estrategia personalizada', async () => {
    jest.useFakeTimers();
    fetch_mock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response('Recuperado', { status: 200 }));

    const retryPolicy: RetryPolicy = {
      shouldRetry: jest.fn(() => true),
      getDelayMs: jest.fn(() => 250),
    };
    const request = new SmartFetchClient(
      {},
      { retryPolicy },
    ).get(
      'https://api.ejemplo.com/data',
      { maxRetries: 1 },
    );

    await jest.advanceTimersByTimeAsync(249);
    expect(fetch_mock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    await expect(request).resolves.toHaveProperty('status', 200);
    expect(fetch_mock).toHaveBeenCalledTimes(2);
  });

  it('permite cancelar la espera entre reintentos', async () => {
    jest.useFakeTimers();
    fetch_mock.mockRejectedValue(new TypeError('fetch failed'));

    const controller = new AbortController();
    const retryPolicy: RetryPolicy = {
      shouldRetry: () => true,
      getDelayMs: () => 1_000,
    };
    const request = new SmartFetchClient(
      {},
      { retryPolicy },
    ).get(
      'https://api.ejemplo.com/data',
      {
        maxRetries: 2,
        signal: controller.signal,
      },
    );

    await jest.advanceTimersByTimeAsync(500);
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch_mock).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('rechaza una espera inválida producida por la estrategia', async () => {
    fetch_mock.mockRejectedValue(new TypeError('fetch failed'));

    const retryPolicy: RetryPolicy = {
      shouldRetry: () => true,
      getDelayMs: () => -1,
    };

    await expect(
      new SmartFetchClient(
        {},
        { retryPolicy },
      ).get(
        'https://api.ejemplo.com/data',
        { maxRetries: 1 },
      ),
    ).rejects.toBeInstanceOf(ConfigurationError);
  });

  it('exporta TimeoutError como error controlado reutilizable', () => {
    const error = new TimeoutError(500);

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('TimeoutError');
    expect(error.timeoutMs).toBe(500);
  });
});
