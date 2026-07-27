# SmartFetch

[![CI](https://github.com/aryacarpavila/SmartFetch/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/aryacarpavila/SmartFetch/actions/workflows/ci.yml)

SmartFetch es una librería que actúa como un wrapper avanzado sobre la API nativa `fetch` de JavaScript. Proporciona una interfaz limpia, resiliente y altamente configurable para realizar consultas a APIs externas sin acoplarse a dependencias adicionales.

La explicación completa de la arquitectura, patrones, pruebas, GitFlow,
publicación y guía de defensa se encuentra en
[`docs/IMPLEMENTACION_Y_DEFENSA.md`](https://github.com/aryacarpavila/SmartFetch/blob/main/docs/IMPLEMENTACION_Y_DEFENSA.md).

## Características

- **Soporte completo HTTP:** GET, POST, PUT, PATCH y DELETE.
- **Resiliencia:** Reintento automático ante errores de servidor (5xx) o problemas de red.
- **Timeouts:** Configuración de un tiempo máximo de espera y cancelación automática.
- **Interceptores:** Interceptores de request y response para modificar encabezados, loguear datos, etc.
- **Manejo de errores:** Tipos de error específicos (`HttpError`, `TimeoutError`, `ConfigurationError`).
- **Flexibilidad:** Uso sencillo mediante promesas (`.then()`) o `async/await`.

## Instalación e integración

SmartFetch requiere Node.js 18 o superior cuando se utiliza en Node, ya que
depende de la implementación nativa de `fetch`.

Para instalar la librería desde NPM, ejecuta el siguiente comando:

```bash
npm install @aryacarpavila/smartfetch
```

Luego puedes integrarla en tu proyecto importando la instancia compartida de la librería:

```typescript
import { smartFetch } from '@aryacarpavila/smartfetch';
```

## Uso de los métodos HTTP (async/await)

### GET
```typescript
try {
  const response = await smartFetch.get('https://api.example.com/users');
  console.log('Usuarios:', await response.json());
} catch (error) {
  console.error('Error:', error);
}
```

### POST
```typescript
const newUser = { name: "Alice", role: "Admin" };
const response = await smartFetch.post('https://api.example.com/users', newUser);
```

### PUT
```typescript
const updatedUser = { name: "Alice", role: "SuperAdmin" };
const response = await smartFetch.put('https://api.example.com/users/1', updatedUser);
```

### PATCH
```typescript
const partialUpdate = { role: "User" };
const response = await smartFetch.patch('https://api.example.com/users/1', partialUpdate);
```

### DELETE
```typescript
const response = await smartFetch.delete('https://api.example.com/users/1');
```

## Uso con Promesas (.then)

También puedes utilizar la librería utilizando la sintaxis tradicional de promesas:

```typescript
smartFetch.get('https://api.example.com/users')
  .then(response => response.json())
  .then(data => console.log('Datos recibidos:', data))
  .catch(error => console.error('Falló la petición:', error));
```

## Características Avanzadas

### Timeout (Tiempo de espera)

Puedes establecer un tiempo límite por petición. Si la petición tarda más de este tiempo, será cancelada y lanzará un `TimeoutError`.

```typescript
const response = await smartFetch.get('https://api.example.com/data', {
  timeoutMs: 3000 // Cancela si demora más de 3 segundos
});
```

### Reintentos (Retries)

Configura cuántas veces intentar de nuevo en caso de un fallo de red o errores del servidor (códigos 5xx).

```typescript
const response = await smartFetch.get('https://api.example.com/data', {
  maxRetries: 3 // Intento original + 3 reintentos adicionales
});
```

### Interceptores

Puedes agregar interceptores para modificar las peticiones antes de que se envíen, o analizar las respuestas antes de que se devuelvan al usuario.

```typescript
// Modificar todas las peticiones
const requestInterceptorId = smartFetch.addRequestInterceptor((config) => {
  const headers = new Headers(config.headers);
  headers.set('Authorization', 'Bearer my-token');

  return { ...config, headers };
});

// Analizar todas las respuestas
const responseInterceptorId = smartFetch.addResponseInterceptor((response) => {
  console.log(`[Response] ${response.status} from ${response.url}`);
  return response;
});

// Retirar los interceptores cuando ya no sean necesarios
smartFetch.removeRequestInterceptor(requestInterceptorId);
smartFetch.removeResponseInterceptor(responseInterceptorId);
```

### Manejo de Errores

SmartFetch exporta clases de errores personalizadas para facilitar el manejo estructurado en los bloques `catch`:

```typescript
import { smartFetch, HttpError, TimeoutError, ConfigurationError } from '@aryacarpavila/smartfetch';

try {
  await smartFetch.get('https://api.example.com/data', { timeoutMs: 100 });
} catch (error) {
  if (error instanceof TimeoutError) {
    console.error('La petición superó el tiempo máximo establecido.');
  } else if (error instanceof HttpError) {
    console.error(`Error del servidor: código ${error.status}`);
  } else if (error instanceof ConfigurationError) {
    console.error(`Error de configuración: ${error.message}`);
  } else {
    console.error('Error inesperado:', error);
  }
}
```
