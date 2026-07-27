# Changelog

Todos los cambios relevantes de SmartFetch se documentan en este archivo.

## 1.0.1 - 2026-07-26

### Cambiado

- El paquete publicable utiliza el scope NPM `@caldera18`.

## 1.0.0 - 2026-07-26

### Añadido

- Cliente configurable sobre la API nativa `fetch`.
- Métodos GET, POST, PUT, PATCH y DELETE.
- Timeout por intento con cancelación mediante `AbortController`.
- Reintentos para errores de red, timeouts y respuestas 5xx.
- Estrategia de reintentos reemplazable con backoff exponencial.
- Interceptores de petición y respuesta.
- Errores tipados para timeout, configuración y respuestas HTTP 5xx.
- Declaraciones TypeScript y paquete CommonJS sin dependencias de ejecución.
- Pruebas automatizadas y validación en Node.js 18, 20, 22 y 24.
