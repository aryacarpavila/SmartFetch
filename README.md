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

> El comando de instalación definitivo se agregará cuando se reserve el nombre
> del paquete en NPM.

## Cómo integrar en un proyecto

Puedes importar la instancia compartida `smartFetch` en tu archivo de TypeScript:

```typescript
import { smartFetch } from './src/index';
```

## Cómo hacer las distintas llamadas a las funciones de la librería

### GET con Timeout

```typescript
const response = await smartFetch.get('https://api.example.com/data', {
  timeoutMs: 3000 // Cancela la petición si tarda más de 3 segundos
});
```

### POST con Reintentos

```typescript
const payloadData = { nameId: "123", value: "test" };

const response = await smartFetch.post(
  'https://api.example.com/data',
  payloadData,
  {
    headers: {
      'Content-Type': 'application/json'
    },
    maxRetries: 2 // Intento original + 2 reintentos
  }
);
```
