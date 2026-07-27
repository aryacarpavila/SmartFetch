/**
 * Error controlado para valores de configuración inválidos.
 */
export class ConfigurationError extends TypeError {
  /**
   * Crea un error de configuración con un mensaje descriptivo.
   *
   * @param message - Explicación del valor inválido.
   */
  public constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
