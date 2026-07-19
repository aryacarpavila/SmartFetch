import { smart_fetch } from './src/index';

async function run_example() {
  console.log("Iniciando peticiones con SmartFetch...");

  // AOP: Interceptor de Peticion (Aspecto que inyecta headers automaticamente)
  smart_fetch.add_request_interceptor((config) => {
    console.log("[Interceptor] Interceptando peticion y agregando token de autorizacion...");
    config.headers = {
      ...config.headers,
      'Authorization': 'Bearer MI_TOKEN_SECRETO'
    };
    return config;
  });

  // AOP: Interceptor de Respuesta (Aspecto que procesa datos automaticamente)
  smart_fetch.add_response_interceptor(async (response) => {
    console.log("[Interceptor] Interceptando respuesta antes de entregarla al usuario...");
    // Podrias transformar la respuesta aqui si quisieras
    return response;
  });

  try {
    const get_response = await smart_fetch.get('https://jsonplaceholder.typicode.com/posts/1', {
      timeout_ms: 2000,
      max_retries: 3
    });

    if (get_response.ok) {
      const json_data = await get_response.json();
      console.log("Datos del GET obtenidos:", json_data.title);
    }

  } catch (error) {
    console.error("La peticion ha fallado definitivamente:", error);
  }
}

run_example();
