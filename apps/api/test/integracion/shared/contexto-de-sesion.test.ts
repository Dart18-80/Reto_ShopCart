import sql from 'mssql';
import { describe, expect, it } from 'vitest';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { ejecutarConContexto } from '../../../src/shared/http/index.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';

interface FilaContexto {
  IDUsuario: number | null;
  Rol: string | null;
  RequestId: string | null;
}

const CLIENTE = {
  requestId: '8f1c2e9a-0000-4000-8000-000000000002',
  idUsuario: 7,
  rol: 'Cliente' as const,
};

usarBaseDePruebas();

function leerContextoDeSesion(): Promise<FilaContexto[]> {
  return ejecutarSP<FilaContexto>('SP_Pruebas_ContextoDeSesion');
}

describe('SP_Sistema_EstablecerContexto (A-18)', () => {
  it('deja en SESSION_CONTEXT el usuario, el rol y el RequestId de la petición', async () => {
    const [fila] = await ejecutarConContexto(CLIENTE, leerContextoDeSesion);

    expect(fila).toEqual({
      IDUsuario: 7,
      Rol: 'Cliente',
      RequestId: '8F1C2E9A-0000-4000-8000-000000000002',
    });
  });

  // En la misma sesión: con el pool, dos llamadas separadas podrían usar conexiones distintas y la
  // prueba pasaría aunque el contexto anterior siguiera ahí.
  it('una llamada sin actor (job) limpia el contexto que dejó la petición anterior', async () => {
    const [fila] = await ejecutarSP<FilaContexto>('SP_Pruebas_ContextoTrasLimpiar', {
      IDUsuarioAnterior: { tipo: sql.Int, valor: CLIENTE.idUsuario },
      RolAnterior: { tipo: sql.VarChar(20), valor: CLIENTE.rol },
    });

    expect(fila).toEqual({ IDUsuario: null, Rol: null, RequestId: null });
  });
});
