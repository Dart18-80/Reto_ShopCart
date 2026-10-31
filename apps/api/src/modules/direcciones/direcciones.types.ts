export interface Departamento {
  idDepartamento: number;
  nombre: string;
}

export interface Municipio {
  idMunicipio: number;
  nombre: string;
}

export interface Direccion {
  idDireccion: number;
  alias: string | null;
  nombreRecibe: string;
  telefonoRecibe: string;
  municipio: Municipio & { departamento: Departamento };
  direccionLinea: string;
  referencia: string | null;
  esPredeterminada: boolean;
}

/** Los valores finales de una dirección, como los recibe el SP. */
export interface DatosDireccion {
  alias: string | null;
  nombreRecibe: string;
  telefonoRecibe: string;
  idMunicipio: number;
  direccionLinea: string;
  referencia: string | null;
  esPredeterminada: boolean;
}
