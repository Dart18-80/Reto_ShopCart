import sql from 'mssql';
import { ejecutarSP, type ParametrosSP } from '../../shared/db/index.js';
import type { DatosDireccion, Departamento, Direccion, Municipio } from './direcciones.types.js';

interface FilaDireccion {
  IDDireccion: number;
  Alias: string | null;
  NombreRecibe: string;
  TelefonoRecibe: string;
  IDMunicipio: number;
  Municipio: string;
  IDDepartamento: number;
  Departamento: string;
  DireccionLinea: string;
  Referencia: string | null;
  EsPredeterminada: boolean;
}

const aDireccion = (fila: FilaDireccion): Direccion => ({
  idDireccion: fila.IDDireccion,
  alias: fila.Alias,
  nombreRecibe: fila.NombreRecibe,
  telefonoRecibe: fila.TelefonoRecibe,
  municipio: {
    idMunicipio: fila.IDMunicipio,
    nombre: fila.Municipio,
    departamento: { idDepartamento: fila.IDDepartamento, nombre: fila.Departamento },
  },
  direccionLinea: fila.DireccionLinea,
  referencia: fila.Referencia,
  esPredeterminada: fila.EsPredeterminada,
});

// Los largos son los mismos que declaran los SPs (NVARCHAR(50), (100), (200)).
function parametrosDireccion(datos: DatosDireccion): ParametrosSP {
  return {
    Alias: { tipo: sql.NVarChar(50), valor: datos.alias },
    NombreRecibe: { tipo: sql.NVarChar(100), valor: datos.nombreRecibe },
    TelefonoRecibe: { tipo: sql.VarChar(8), valor: datos.telefonoRecibe },
    IDMunicipio: { tipo: sql.Int, valor: datos.idMunicipio },
    DireccionLinea: { tipo: sql.NVarChar(200), valor: datos.direccionLinea },
    Referencia: { tipo: sql.NVarChar(200), valor: datos.referencia },
    EsPredeterminada: { tipo: sql.Bit, valor: datos.esPredeterminada },
  };
}

function unica(filas: FilaDireccion[], sp: string): Direccion {
  const [fila] = filas;
  if (fila === undefined) throw new Error(`${sp} no devolvió la dirección`);
  return aDireccion(fila);
}

// RF-01: el dueño sale siempre de @IDUsuarioActor (el token); el repositorio no recibe el ID del cliente.
export const direccionesRepository = {
  async listarPropias(): Promise<Direccion[]> {
    return (await ejecutarSP<FilaDireccion>('SP_Direcciones_Listar')).map(aDireccion);
  },

  /** null si no existe o si es de otro cliente. */
  async obtenerPropia(idDireccion: number): Promise<Direccion | null> {
    const [fila] = await ejecutarSP<FilaDireccion>('SP_Direcciones_Listar', {
      IDDireccion: { tipo: sql.Int, valor: idDireccion },
    });
    return fila === undefined ? null : aDireccion(fila);
  },

  async crear(datos: DatosDireccion): Promise<Direccion> {
    const filas = await ejecutarSP<FilaDireccion>(
      'SP_Direcciones_Crear',
      parametrosDireccion(datos),
    );
    return unica(filas, 'SP_Direcciones_Crear');
  },

  async actualizar(idDireccion: number, datos: DatosDireccion): Promise<Direccion> {
    const filas = await ejecutarSP<FilaDireccion>('SP_Direcciones_Actualizar', {
      IDDireccion: { tipo: sql.Int, valor: idDireccion },
      ...parametrosDireccion(datos),
    });
    return unica(filas, 'SP_Direcciones_Actualizar');
  },

  async eliminar(idDireccion: number): Promise<void> {
    await ejecutarSP('SP_Direcciones_Eliminar', {
      IDDireccion: { tipo: sql.Int, valor: idDireccion },
    });
  },

  async listarDepartamentos(): Promise<Departamento[]> {
    const filas = await ejecutarSP<{ IDDepartamento: number; Nombre: string }>(
      'SP_Direcciones_ListarDepartamentos',
    );
    return filas.map((fila) => ({ idDepartamento: fila.IDDepartamento, nombre: fila.Nombre }));
  },

  async listarMunicipios(idDepartamento: number): Promise<Municipio[]> {
    const filas = await ejecutarSP<{ IDMunicipio: number; Nombre: string }>(
      'SP_Direcciones_ListarMunicipios',
      { IDDepartamento: { tipo: sql.Int, valor: idDepartamento } },
    );
    return filas.map((fila) => ({ idMunicipio: fila.IDMunicipio, nombre: fila.Nombre }));
  },
};

export type DireccionesRepository = typeof direccionesRepository;
