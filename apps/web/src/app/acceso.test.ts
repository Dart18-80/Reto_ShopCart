import { describe, expect, it } from 'vitest';
import { ErrorApi, type EstadoSesion, type Rol } from '../shared/api';
import { usuarioDePrueba } from '../test/sesion';
import {
  CON_SESION,
  INVITADO_O_CLIENTE,
  PERSONAL,
  PUBLICO,
  permisoPara,
  SOLO_ADMINISTRADOR,
  SOLO_CLIENTE,
} from './acceso';

const activa = (rol: Rol): EstadoSesion => ({ tipo: 'activa', usuario: usuarioDePrueba(rol) });
const INVITADO: EstadoSesion = { tipo: 'invitado' };
const REHIDRATANDO: EstadoSesion = { tipo: 'rehidratando' };
const NO_VERIFICADA: EstadoSesion = { tipo: 'noVerificada', error: ErrorApi.deRed() };

describe('permisoPara', () => {
  it('con sesión decide el rol', () => {
    expect(permisoPara(PERSONAL, activa('Operador'))).toBe('permitido');
    expect(permisoPara(PERSONAL, activa('Cliente'))).toBe('sinPermiso');
    expect(permisoPara(SOLO_ADMINISTRADOR, activa('Operador'))).toBe('sinPermiso');
    expect(permisoPara(CON_SESION, activa('Cliente'))).toBe('permitido');
  });

  it('el carrito es de invitados y Clientes, no del personal (autorizarSiHaySesion del backend)', () => {
    expect(permisoPara(INVITADO_O_CLIENTE, INVITADO)).toBe('permitido');
    expect(permisoPara(INVITADO_O_CLIENTE, activa('Cliente'))).toBe('permitido');
    expect(permisoPara(INVITADO_O_CLIENTE, activa('Administrador'))).toBe('sinPermiso');
  });

  it('un invitado en una ruta con sesión va a ingresar', () => {
    expect(permisoPara(SOLO_CLIENTE, INVITADO)).toBe('ingresar');
    expect(permisoPara(PUBLICO, INVITADO)).toBe('permitido');
  });

  it('mientras rehidrata, una ruta con sesión espera; una que admite invitados se muestra', () => {
    expect(permisoPara(CON_SESION, REHIDRATANDO)).toBe('verificando');
    expect(permisoPara(PUBLICO, REHIDRATANDO)).toBe('permitido');
  });

  it('con la sesión no verificada, una ruta con sesión muestra el error; la tienda sigue como invitado', () => {
    expect(permisoPara(SOLO_CLIENTE, NO_VERIFICADA)).toBe('sinVerificar');
    expect(permisoPara(INVITADO_O_CLIENTE, NO_VERIFICADA)).toBe('permitido');
  });
});
