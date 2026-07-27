/**
 * Combina colecciones de headers respetando el orden de precedencia.
 *
 * Los headers de las últimas colecciones reemplazan valores anteriores sin
 * importar las diferencias entre mayúsculas y minúsculas.
 *
 * @param sources - Colecciones ordenadas desde menor a mayor precedencia.
 * @returns Headers combinados o `undefined` cuando no se recibió ninguno.
 */
export function mergeHeaders(
  ...sources: Array<HeadersInit | undefined>
): Headers | undefined {
  const mergedHeaders = new Headers();
  let receivedHeaders = false;

  for (const source of sources) {
    if (source === undefined) {
      continue;
    }

    receivedHeaders = true;
    new Headers(source).forEach((value, name) => {
      mergedHeaders.set(name, value);
    });
  }

  return receivedHeaders ? mergedHeaders : undefined;
}
