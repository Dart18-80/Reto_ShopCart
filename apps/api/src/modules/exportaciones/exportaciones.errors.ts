/** E7-H05: un error que reintentar no arregla (el reporte pasa el límite de filas, filtros que ya no valen). */
export class ExportacionImposible extends Error {
  constructor(mensaje: string, opciones?: ErrorOptions) {
    super(mensaje, opciones);
    this.name = 'ExportacionImposible';
  }
}
