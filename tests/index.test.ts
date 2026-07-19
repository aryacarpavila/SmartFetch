import { smart_fetch, SmartFetchClient } from '../src/index';

global.fetch = jest.fn() as jest.Mock;

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
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('https://api.ejemplo.com/data', expect.objectContaining({ method: 'GET' }));
  });

  it('deberia realizar una peticion POST con payload', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 201 })
    );

    const user_post = { name_id: "123", value: "test" };
    const response = await smart_fetch.post('https://api.ejemplo.com/data', user_post);
    
    expect(response.status).toBe(201);
    expect(global.fetch).toHaveBeenCalledWith('https://api.ejemplo.com/data', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(user_post)
    }));
  });

  it('deberia fallar si el servidor devuelve error 500 y no hay reintentos', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response('Error interno', { status: 500 })
    );

    await expect(smart_fetch.get('https://api.ejemplo.com/data')).rejects.toThrow('Error del servidor. Código de estado: 500');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('SmartFetchClient (Factory/Instances)', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('deberia reintentar automaticamente segun la configuracion de la instancia', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response('Error interno', { status: 500 })
    );

    const custom_client = smart_fetch.create({ max_retries: 2 });
    await expect(custom_client.request('https://api.ejemplo.com/data')).rejects.toThrow();
    
    // 1 original + 2 reintentos
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
