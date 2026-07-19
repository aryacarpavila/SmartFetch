import { smart_fetch, SmartFetchClient } from '../src/index';

global.fetch = jest.fn() as jest.Mock;

describe('smart_fetch (AOP Interceptors)', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('deberia ejecutar interceptores de peticion (RequestInterceptor)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Exito' }), { status: 200 })
    );

    const client = new SmartFetchClient();
    client.add_request_interceptor((config) => {
      config.headers = { ...config.headers, 'Authorization': 'Bearer 123' };
      return config;
    });

    await client.get('https://api.ejemplo.com/data');
    
    expect(global.fetch).toHaveBeenCalledWith('https://api.ejemplo.com/data', expect.objectContaining({
      headers: { 'Authorization': 'Bearer 123' }
    }));
  });

  it('deberia ejecutar interceptores de respuesta (ResponseInterceptor)', async () => {
    const mock_response = new Response(JSON.stringify({ message: 'Original' }), { status: 200 });
    (global.fetch as jest.Mock).mockResolvedValueOnce(mock_response);

    const client = new SmartFetchClient();
    client.add_response_interceptor(async (response) => {
      // Simulamos que el interceptor inyecta un header extra en la respuesta final
      Object.defineProperty(response, 'intercepted', { value: true });
      return response;
    });

    const final_res: any = await client.get('https://api.ejemplo.com/data');
    
    expect(final_res.intercepted).toBe(true);
  });
});

describe('smart_fetch (Singleton Instance)', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('deberia realizar una peticion exitosa usando el metodo get', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Exito' }), { status: 200 })
    );

    const response = await smart_fetch.get('https://api.ejemplo.com/data');
    expect(response.status).toBe(200);
  });

  it('deberia reintentar automaticamente segun la configuracion de la instancia', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response('Error interno', { status: 500 })
    );

    const custom_client = smart_fetch.create({ max_retries: 2 });
    await expect(custom_client.request('https://api.ejemplo.com/data')).rejects.toThrow();
    
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
