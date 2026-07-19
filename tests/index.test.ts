import { smart_fetch } from '../src/index';

// Necesitamos mockear la función global fetch para nuestras pruebas
global.fetch = jest.fn() as jest.Mock;

describe('smart_fetch', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('deberia realizar una peticion exitosa (metodo GET)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Exito' }), { status: 200 })
    );

    const response = await smart_fetch('https://api.ejemplo.com/data');
    
    expect(response.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('deberia fallar si el servidor devuelve un error 500 y no hay reintentos extras', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response('Error interno', { status: 500 })
    );

    await expect(smart_fetch('https://api.ejemplo.com/data')).rejects.toThrow('Error del servidor. Código de estado: 500');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('deberia reintentar la peticion si hay un error de servidor', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response('Error interno', { status: 500 })
    );

    await expect(smart_fetch('https://api.ejemplo.com/data', { max_retries: 2 })).rejects.toThrow();
    // 1 intento original + 2 reintentos
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});
