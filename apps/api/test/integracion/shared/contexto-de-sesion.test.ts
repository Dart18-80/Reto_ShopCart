import type sql from 'mssql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { ejecutarConContexto } from '../../../src/shared/http/index.js';
import { conectarBaseDePruebas } from '../base-de-pruebas.js';

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

let pool: sql.ConnectionPool | undefined;

beforeAll(async () => {
  pool = await conectarBaseDePruebas();
});

afterAll(async () => {
  await pool?.close();
});

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

  it('una llamada sin actor (job) limpia el contexto que dejó la petición anterior', async () => {
    await ejecutarConContexto(CLIENTE, leerContextoDeSesion);

    const [fila] = await leerContextoDeSesion();

    expect(fila).toEqual({ IDUsuario: null, Rol: null, RequestId: null });
  });
});
