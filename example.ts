import { smart_fetch } from './src/index';

async function run_example() {
  console.log("Iniciando peticiones con la instancia Singleton de SmartFetch...");

  try {
    // Ejemplo de GET directo
    const get_response = await smart_fetch.get('https://jsonplaceholder.typicode.com/posts/1', {
      timeout_ms: 2000,
      max_retries: 3
    });

    if (get_response.ok) {
      const json_data = await get_response.json();
      console.log("Datos del GET obtenidos:", json_data.title);
    }

    // Ejemplo de POST utilizando los alias de la clase y variables en ingles
    const user_post = {
      name_id: "test_user_01",
      title: "Nuevo post"
    };

    const post_response = await smart_fetch.post('https://jsonplaceholder.typicode.com/posts', user_post, {
      max_retries: 2
    });

    if (post_response.ok) {
      const new_post_data = await post_response.json();
      console.log("Respuesta del POST:", new_post_data);
    }
  } catch (error) {
    console.error("La peticion ha fallado definitivamente:", error);
  }
}

run_example();
