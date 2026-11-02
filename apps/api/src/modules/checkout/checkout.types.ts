import type { Decimal } from 'decimal.js';

/** N-02: lo que se cobra por línea, congelado al iniciar el pago. */
export interface LineaSesion {
  idVariante: number;
  idProducto: number;
  producto: string;
  sku: string;
  descripcionAtributos: string;
  cantidad: number;
  precioUnitario: Decimal;
  descuentoLinea: Decimal;
  totalLinea: Decimal;
}

/** RF-06: la sesión de pago Activa del cliente, con la dirección y los montos copiados (M-04). */
export interface SesionPago {
  idSesion: number;
  expiraEn: Date;
  direccion: {
    nombreRecibe: string;
    telefonoRecibe: string;
    idMunicipio: number;
    municipio: string;
    departamento: string;
    direccionLinea: string;
    referencia: string | null;
  };
  envio: {
    idMetodoEnvio: number;
    nombre: string;
    diasMin: number;
    diasMax: number;
    costo: Decimal;
  };
  codigoCupon: string | null;
  lineas: LineaSesion[];
  subtotal: Decimal;
  descuento: Decimal;
  total: Decimal;
  intentosRechazados: number;
}

export interface SesionIniciada {
  sesion: SesionPago;
  /** false si se reutilizó la sesión Activa porque el contenido no cambió (la API responde 200). */
  creada: boolean;
}

export interface DatosInicioPago {
  idDireccion: number;
  idMetodoEnvio: number;
}
