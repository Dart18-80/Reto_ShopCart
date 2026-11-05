import { describe, expect, it } from 'vitest';
import { destinoAlIngresar } from './destino';

describe('destinoAlIngresar: volver seguro', () => {
  it.each([
    'https://otro.sitio',
    '//otro.sitio',
    '/\\otro.sitio',
    '\\\\otro.sitio',
    'javascript:alert(1)',
    'otra-ruta',
    ' /carrito',
    '',
  ])('«%s» no es una ruta interna: lleva al destino por defecto', (volver) => {
    expect(destinoAlIngresar(volver, 'Cliente')).toBe('/');
  });

  it.each([
    ['/carrito', '/carrito'],
    ['/cuenta/perfil?pestana=datos', '/cuenta/perfil?pestana=datos'],
    ['/productos/12#detalle', '/productos/12#detalle'],
  ])('«%s» es una ruta interna y se respeta', (volver, esperado) => {
    expect(destinoAlIngresar(volver, 'Cliente')).toBe(esperado);
  });

  it('sin volver, el Cliente va a la tienda y el personal al backoffice', () => {
    expect(destinoAlIngresar(null, 'Cliente')).toBe('/');
    expect(destinoAlIngresar(null, 'Operador')).toBe('/backoffice');
    expect(destinoAlIngresar(null, 'Administrador')).toBe('/backoffice');
  });

  it('volver a /ingresar o /registro no tiene sentido con sesión: va al destino por defecto', () => {
    expect(destinoAlIngresar('/ingresar?volver=/carrito', 'Cliente')).toBe('/');
    expect(destinoAlIngresar('/registro', 'Operador')).toBe('/backoffice');
  });
});
