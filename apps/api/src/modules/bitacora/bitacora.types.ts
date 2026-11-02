/** RF-09: los módulos que registran en la bitácora (CK_Bitacora_Modulo). */
export const MODULOS_BITACORA = [
  'Catalogo',
  'Inventario',
  'Cupones',
  'Pedidos',
  'Envios',
  'Usuarios',
  'Configuracion',
] as const;
export type ModuloBitacora = (typeof MODULOS_BITACORA)[number];

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
