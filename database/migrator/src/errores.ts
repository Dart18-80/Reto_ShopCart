export class ErrorMigracion extends Error {
  constructor(mensaje: string, opciones?: ErrorOptions) {
    super(mensaje, opciones);
    this.name = 'ErrorMigracion';
  }
}

export function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
