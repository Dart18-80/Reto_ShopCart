import type { RolDeUsuario } from '@shopcart/shared';
import { describe, expectTypeOf, it } from 'vitest';
import type { Rol } from './sesion/sesion';
import type { Cuerpo, Respuesta } from './tipos';

// Los tipos de ayuda salen del contrato generado (FE-13): si el backend cambia la forma, esto no compila.
describe('Respuesta y Cuerpo', () => {
  it('Respuesta da el JSON de la respuesta exitosa', () => {
    expectTypeOf<
      Respuesta<'/api/v1/auth/login', 'post'>['datos']['accessToken']
    >().toEqualTypeOf<string>();
  });

  it('Cuerpo da el JSON que acepta la operación', () => {
    expectTypeOf<Cuerpo<'/api/v1/auth/login', 'post'>>().toHaveProperty('correo');
  });

  it('un método que la ruta no tiene no compila', () => {
    // @ts-expect-error: /api/v1/auth/login no tiene GET
    expectTypeOf<Respuesta<'/api/v1/auth/login', 'get'>>().toBeNever();
  });
});

describe('roles', () => {
  it('los roles compartidos con la API son exactamente los del contrato', () => {
    expectTypeOf<RolDeUsuario>().toEqualTypeOf<Rol>();
  });
});
