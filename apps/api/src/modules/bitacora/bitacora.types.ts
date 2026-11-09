// RF-09: los módulos viven en @shopcart/shared con la consulta (M10-H02).
export { MODULOS_BITACORA, type ModuloBitacora } from '@shopcart/shared';

export interface RegistroBitacora {
  idBitacora: string;
  modulo: string;
  entidad: string;
  idEntidad: string;
  accion: string;
  /** El JSON guardado por el trigger (solo columnas no sensibles); null en una creación o eliminación. */
  valorAnterior: unknown;
  valorNuevo: unknown;
  /** null si lo hizo un proceso del sistema (un job o el migrador). */
  usuario: { idUsuario: number; nombre: string } | null;
  requestId: string | null;
  fecha: Date;
}
