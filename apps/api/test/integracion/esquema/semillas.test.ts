import type sql from 'mssql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { conectarBaseDePruebas } from '../base-de-pruebas.js';
import { unaFila } from '../datos-de-prueba.js';
import { aMonto } from '../../../src/shared/dinero/index.js';

interface ResumenSemilla {
  Departamentos: number;
  Municipios: number;
  DepartamentosSinMunicipios: number;
  Roles: number;
  EstadosPedido: number;
  Transiciones: number;
  TiposMovimiento: number;
  MetodosEnvio: number;
  ParametrosSistema: number;
  UsuariosDemo: number;
  ProductosDemo: number;
  ProductosInactivos: number;
  VariantesDemo: number;
  VariantesSinExistencia: number;
  VariantesConUnaUnidad: number;
  SKUConUnaUnidad: string | null;
  VariantesConHistorialPrecio: number;
  PrecioMinimo: number;
  PrecioMaximo: number;
  ProductosSinImagenPrincipal: number;
  VariantesDescuadradas: number;
}

let pool: sql.ConnectionPool | undefined;
let resumen: ResumenSemilla;

beforeAll(async () => {
  pool = await conectarBaseDePruebas();
  resumen = await unaFila<ResumenSemilla>('SP_Pruebas_ResumenSemilla');
});

afterAll(async () => {
  await pool?.close();
});

describe('S001 catálogos (E1-H06)', () => {
  it('carga los roles, estados, tipos de movimiento, métodos de envío y la fila de parámetros', () => {
    expect(resumen).toMatchObject({
      Roles: 3,
      EstadosPedido: 7,
      TiposMovimiento: 6,
      MetodosEnvio: 2,
      ParametrosSistema: 1,
    });
  });

  it('carga las 18 transiciones por rol de §3.9', () => {
    expect(resumen.Transiciones).toBe(18);
  });
});

describe('S002 geografía (E1-H06, N-17)', () => {
  it('hay 340 municipios ligados a sus 22 departamentos', () => {
    expect(resumen).toMatchObject({
      Departamentos: 22,
      Municipios: 340,
      DepartamentosSinMunicipios: 0,
    });
  });
});

describe('S003 usuarios demo (E1-H06)', () => {
  it('crea las cuatro cuentas demo', () => {
    expect(resumen.UsuariosDemo).toBe(4);
  });
});

describe('S004 catálogo demo (E1-H06, N-07, N-19)', () => {
  it('VW_Inventario_Conciliacion queda vacía para todo el catálogo demo', () => {
    expect(resumen.VariantesDescuadradas).toBe(0);
  });

  it('tiene ~60 productos y ~250 variantes, 2 productos desactivados y todos con imagen principal', () => {
    expect(resumen.ProductosDemo).toBeGreaterThanOrEqual(55);
    expect(resumen.VariantesDemo).toBeGreaterThanOrEqual(230);
    expect(resumen.ProductosInactivos).toBe(2);
    expect(resumen.ProductosSinImagenPrincipal).toBe(0);
  });

  it('exactamente una variante con 1 unidad: DEMO-CONCURRENCIA (RF-06)', () => {
    expect(resumen.VariantesConUnaUnidad).toBe(1);
    expect(resumen.SKUConUnaUnidad).toBe('DEMO-CONCURRENCIA');
  });

  it('incluye variantes agotadas e historial de precios', () => {
    expect(resumen.VariantesSinExistencia).toBeGreaterThan(0);
    expect(resumen.VariantesConHistorialPrecio).toBeGreaterThanOrEqual(10);
  });

  it('los precios vigentes van de Q79 a Q899', () => {
    expect(aMonto(resumen.PrecioMinimo).toFixed(2)).toBe('79.00');
    expect(aMonto(resumen.PrecioMaximo).toFixed(2)).toBe('899.00');
  });
});
