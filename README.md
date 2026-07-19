# SmartFetch

SmartFetch es una librería que actúa como un wrapper avanzado sobre la API nativa `fetch` de JavaScript. Proporciona una interfaz limpia, resiliente y altamente configurable para realizar consultas a APIs externas sin acoplarse a otras librerías y dependencias externas.

## Características

- Configuración de un tiempo máximo de espera (timeout) para las peticiones.
- Reintento automático ante errores de servidor (5xx) o problemas de red.
- Soporta todos los métodos HTTP principales (GET, POST, PUT, PATCH, DELETE).
- Uso sencillo mediante promesas o `async/await`.

## Cómo descargar la librería con NPM

*(Nota: Este paquete es un proyecto de ejemplo, para descargarlo localmente usa)*

```bash
git clone https://github.com/TU_USUARIO/SmartFetch.git
cd SmartFetch
npm install
npm run build
```

*(Si se publicara en npm)*
```bash
npm install smart_fetch
```

## Cómo integrar en un proyecto

Puedes importar la función `smart_fetch` en tu archivo de TypeScript o JavaScript de la siguiente manera:

```typescript
import { smart_fetch } from './src/index';
```

## Cómo hacer las distintas llamadas a las funciones de la librería

### GET con Timeout

```typescript
const response = await smart_fetch('https://api.example.com/data', {
  method: 'GET',
  timeout_ms: 3000 // Cancela la petición si tarda más de 3 milisegundos
});
```

### POST con Reintentos

```typescript
const payload_data = { name_id: "123", value: "test" };

const response = await smart_fetch('https://api.example.com/data', {
  method: 'POST',
  body: JSON.stringify(payload_data),
  headers: {
    'Content-Type': 'application/json'
  },
  max_retries: 2 // Intentará la petición original + 2 veces en caso de error de servidor
});
```
