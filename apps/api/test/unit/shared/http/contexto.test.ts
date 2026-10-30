import { describe, expect, it } from 'vitest';
import {
  ejecutarConContexto,
  establecerUsuario,
  obtenerContexto,
} from '../../../../src/shared/http/contexto.js';

const PETICION_ANONIMA = {
  requestId: '8f1c2e9a-0000-4000-8000-000000000001',
  idUsuario: null,
  rol: null,
};

describe('establecerUsuario', () => {
  it('deja al usuario autenticado en el contexto de la petición en curso', () => {
    const contexto = ejecutarConContexto({ ...PETICION_ANONIMA }, () => {
      establecerUsuario(7, 'Cliente');
      return obtenerContexto();
    });

    expect(contexto).toEqual({ ...PETICION_ANONIMA, idUsuario: 7, rol: 'Cliente' });
  });

  it('no afecta el contexto de otra petición', () => {
    const otra = ejecutarConContexto({ ...PETICION_ANONIMA }, () => obtenerContexto());

    ejecutarConContexto({ ...PETICION_ANONIMA }, () => {
      establecerUsuario(7, 'Cliente');
    });

    expect(otra?.idUsuario).toBeNull();
  });

  it('fuera de una petición lanza un error en lugar de perder el usuario', () => {
    expect(() => {
      establecerUsuario(7, 'Cliente');
    }).toThrow(/fuera de una petición/);
  });
});
