import { describe, expect, it } from 'vitest';
import { leerConfiguracion } from '../src/config.ts';
import { BASE_PRUEBAS } from '../src/conexion.ts';
import { ErrorMigracion } from '../src/errores.ts';

const ENTORNO_VALIDO = {
  MSSQL_SA_PASSWORD: 'Administrador.1',
  DB_USUARIO: 'shopcart_app',
  DB_CONTRASENA: 'Aplicacion.123',
  DB_MIGRADOR_CONTRASENA: 'Migrador.1234',
};

function leerCon(cambios: Record<string, string | undefined>, argumentos: string[] = []) {
  return leerConfiguracion({ ...ENTORNO_VALIDO, ...cambios }, argumentos);
}

describe('leerConfiguracion del migrador', () => {
  it('aplica los valores por defecto', () => {
    expect(leerCon({})).toMatchObject({
      servidor: 'localhost',
      puerto: 1433,
      baseDatos: 'ShopCart',
      recrearBase: false,
      confiarCertificado: true,
    });
  });

  it('con --pruebas apunta siempre a shopcart_test y la recrea, aunque DB_NOMBRE diga otra cosa', () => {
    expect(leerCon({ DB_NOMBRE: 'ShopCart' }, ['--pruebas'])).toMatchObject({
      baseDatos: BASE_PRUEBAS,
      recrearBase: true,
    });
  });

  it.each(['MSSQL_SA_PASSWORD', 'DB_USUARIO', 'DB_CONTRASENA', 'DB_MIGRADOR_CONTRASENA'])(
    'falla con un mensaje claro si falta %s',
    (variable) => {
      expect(() => leerCon({ [variable]: undefined })).toThrow(ErrorMigracion);
      expect(() => leerCon({ [variable]: undefined })).toThrow(new RegExp(variable));
    },
  );

  it('rechaza un login de la app distinto de shopcart_app (V001 le da los permisos por nombre)', () => {
    expect(() => leerCon({ DB_USUARIO: 'sa' })).toThrow(/shopcart_app/);
  });

  it.each([
    ['7 caracteres', 'Corta.1', false],
    ['8 caracteres', 'Larga.12', true],
    ['128 caracteres', 'a'.repeat(128), true],
    ['129 caracteres', 'a'.repeat(129), false],
  ])('contraseña de un login con %s', (_caso, contrasena, valida) => {
    const leer = () => leerCon({ DB_CONTRASENA: contrasena });

    if (valida) expect(leer).not.toThrow();
    else expect(leer).toThrow(ErrorMigracion);
  });

  it.each([
    'Shop Cart',
    'ShopCart];DROP DATABASE master;--',
    '1ShopCart',
    'Shop-Cart',
    '',
    'Base_ñ',
  ])('rechaza un nombre de base que no es un identificador simple: %j', (nombre) => {
    expect(() => leerCon({ DB_NOMBRE: nombre })).toThrow(ErrorMigracion);
  });

  it('acepta un nombre de base de 128 caracteres y rechaza uno de 129', () => {
    expect(() => leerCon({ DB_NOMBRE: `S${'a'.repeat(127)}` })).not.toThrow();
    expect(() => leerCon({ DB_NOMBRE: `S${'a'.repeat(128)}` })).toThrow(ErrorMigracion);
  });

  it.each(['0', '65536', 'mil', '1433.5', '-1'])('rechaza el puerto %j', (puerto) => {
    expect(() => leerCon({ DB_PORT: puerto })).toThrow(ErrorMigracion);
  });

  it('rechaza DB_CONFIAR_CERTIFICADO que no sea true o false', () => {
    expect(() => leerCon({ DB_CONFIAR_CERTIFICADO: 'si' })).toThrow(ErrorMigracion);
  });
});
