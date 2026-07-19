import { smart_fetch } from './src/index';

async function run_example() {
  console.log("Iniciando peticion GET con SmartFetch...");

  try {
    const response = await smart_fetch('https://jsonplaceholder.typicode.com/posts/1', {
      method: 'GET',
      timeout_ms: 2000,
      max_retries: 3
    });

    if (response.ok) {
      const json_data = await response.json();
      console.log("Datos obtenidos:", json_data);
    } else {
      console.error("Error en la peticion con codigo:", response.status);
    }
  } catch (error) {
    console.error("La peticion ha fallado definitivamente:", error);
  }
}

run_example();
