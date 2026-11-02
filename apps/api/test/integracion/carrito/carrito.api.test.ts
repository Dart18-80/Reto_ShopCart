import { randomBytes } from 'node:crypto';
import { Writable } from 'node:stream';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../../src/app.js';
import type { LimitadorIntentos } from '../../../src/shared/http/index.js';
import { crearLogger } from '../../../src/shared/observability/index.js';
import { leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba, SIN_LIMITE } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { fijarExistencia } from '../datos-de-prueba.js';
import {
  agregar,
  cambiarCantidad,
  carritosConHash,
  carritosDelCliente,
  clienteNuevo,
  comoCliente,
  comoInvitado,
  cookieCarrito,
  hashDe,
  invitadoConCarrito,
  leerCarrito,
  primeraLinea,
  quitarLinea,
  tokenCarrito,
  varianteVendible,
  variantesVendibles,
  verCarrito,
} from './apoyo-carrito.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const ID_INEXISTENTE = 2_147_483_647;
const TOKEN_256_BITS_BASE64URL = /^[A-Za-z0-9_-]{43}$/;
// Las pruebas que llenan un carrito hacen unas 50 peticiones seguidas.
const TIMEOUT_CARRITO_LLENO_MS = 30_000;

let tokenAdmin: string;
let tokenOperador: string;

beforeAll(async () => {
  tokenAdmin = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken;
  tokenOperador = leerSesion(
    await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'),
  ).accessToken;
});

const desactivar = (recurso: 'productos' | 'variantes', id: number) =>
  request(app)
    .post(`/api/v1/admin/${recurso}/${String(id)}/desactivar`)
    .set(comoCliente(tokenAdmin));

describe('carrito de invitado (E4-H01, N-05)', () => {
  it('el primer producto crea el carrito y deja un token de 256 bits solo en una cookie httpOnly, SameSite=Lax, Path=/api/v1 y Secure', async () => {
    const { IDVariante } = await varianteVendible();

    const respuesta = await agregar(app, comoInvitado(), IDVariante, 2);

    expect(respuesta.status).toBe(200);
    const cookie = cookieCarrito(respuesta) ?? '';
    expect(cookie).toMatch(/; HttpOnly/i);
    expect(cookie).toMatch(/; SameSite=Lax/i);
    expect(cookie).toMatch(/; Path=\/api\/v1(;|$)/i);
    expect(cookie).toMatch(/; Secure/i);
    expect(tokenCarrito(respuesta)).toMatch(TOKEN_256_BITS_BASE64URL);
    expect(primeraLinea(leerCarrito(respuesta))).toMatchObject({
      idVariante: IDVariante,
      cantidad: 2,
    });
  });

  it('nunca expone el ID del carrito', async () => {
    const { IDVariante } = await varianteVendible();
    const { token } = await invitadoConCarrito(app, IDVariante);

    const respuesta = await verCarrito(app, comoInvitado(token));

    expect(JSON.stringify(respuesta.body)).not.toMatch(/idCarrito/i);
  });

  it('en la base solo queda el SHA-256 del token', async () => {
    const { IDVariante } = await varianteVendible();
    const { token } = await invitadoConCarrito(app, IDVariante);

    expect(await carritosConHash(hashDe(token))).toMatchObject([{ Estado: 'Activo', Lineas: 1 }]);
    expect(await carritosConHash(Buffer.from(token, 'base64url'))).toEqual([]);
  });

  it('con la cookie, agregar usa el mismo carrito y no emite otra cookie', async () => {
    const [primera, segunda] = await variantesVendibles('10.00', 10, 2);
    const { token } = await invitadoConCarrito(app, primera?.IDVariante ?? 0);

    const respuesta = await agregar(app, comoInvitado(token), segunda?.IDVariante ?? 0);

    expect(respuesta.status).toBe(200);
    expect(cookieCarrito(respuesta)).toBeUndefined();
    expect(leerCarrito(respuesta).lineas).toHaveLength(2);
    expect(await carritosConHash(hashDe(token))).toMatchObject([{ Lineas: 2 }]);
  });

  it('sin cookie, GET responde un carrito vacío y no crea nada', async () => {
    const respuesta = await verCarrito(app, comoInvitado());

    expect(respuesta.status).toBe(200);
    expect(cookieCarrito(respuesta)).toBeUndefined();
    expect(leerCarrito(respuesta)).toEqual({
      lineas: [],
      resumen: {
        lineas: 0,
        unidades: 0,
        subtotal: '0.00',
        descuento: '0.00',
        total: '0.00',
        puedePagar: false,
        cupon: null,
        cuponRetirado: null,
      },
    });
  });

  it('una cookie sin carrito: GET la borra y POST crea otro carrito con un token nuevo', async () => {
    const { IDVariante } = await varianteVendible();
    const ajeno = randomBytes(32).toString('base64url');

    const consulta = await verCarrito(app, comoInvitado(ajeno));
    const alta = await agregar(app, comoInvitado(ajeno), IDVariante);

    expect(leerCarrito(consulta).lineas).toEqual([]);
    expect(cookieCarrito(consulta)).toMatch(/^carrito_invitado=;.*Expires=Thu, 01 Jan 1970/);
    expect(alta.status).toBe(200);
    expect(tokenCarrito(alta)).not.toBe(ajeno);
    expect(await carritosConHash(hashDe(ajeno))).toEqual([]);
  });

  it('una cookie mal formada cuenta como ausente', async () => {
    const respuesta = await verCarrito(app, comoInvitado('no-es-un-token'));

    expect(respuesta.status).toBe(200);
    expect(leerCarrito(respuesta).lineas).toEqual([]);
  });
});

describe('carrito del cliente (E4-H01, N-05)', () => {
  it('sale del token: no emite cookie y el cliente tiene un solo carrito activo', async () => {
    const [primera, segunda] = await variantesVendibles('10.00', 10, 2);
    const cliente = await clienteNuevo(app);

    const alta = await agregar(app, comoCliente(cliente.token), primera?.IDVariante ?? 0);
    await agregar(app, comoCliente(cliente.token), segunda?.IDVariante ?? 0);

    expect(alta.status).toBe(200);
    expect(cookieCarrito(alta)).toBeUndefined();
    expect(await carritosDelCliente(cliente.idUsuario)).toMatchObject([
      { Estado: 'Activo', Lineas: 2 },
    ]);
  });

  it('con sesión manda el carrito del cliente aunque llegue la cookie de invitado', async () => {
    const [deInvitado, deCliente] = await variantesVendibles('10.00', 10, 2);
    const invitado = await invitadoConCarrito(app, deInvitado?.IDVariante ?? 0);
    const cliente = await clienteNuevo(app);
    const ambos = { ...comoCliente(cliente.token), ...comoInvitado(invitado.token) };

    const respuesta = await agregar(app, ambos, deCliente?.IDVariante ?? 0);
    const delInvitado = await verCarrito(app, comoInvitado(invitado.token));

    expect(leerCarrito(respuesta).lineas.map((l) => l.idVariante)).toEqual([deCliente?.IDVariante]);
    expect(leerCarrito(delInvitado).lineas.map((l) => l.idVariante)).toEqual([
      deInvitado?.IDVariante,
    ]);
  });

  it.each([
    ['Operador', () => tokenOperador],
    ['Admin', () => tokenAdmin],
  ])('el %s recibe 403 en las cuatro rutas', async (_rol, token) => {
    const { IDVariante } = await varianteVendible();
    const cabeceras = comoCliente(token());

    const respuestas = await Promise.all([
      verCarrito(app, cabeceras),
      agregar(app, cabeceras, IDVariante),
      cambiarCantidad(app, cabeceras, 1, 1),
      quitarLinea(app, cabeceras, 1),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([403, 403, 403, 403]);
  });

  it('un token inválido responde 401 y no cae a invitado', async () => {
    const { IDVariante } = await varianteVendible();

    const respuesta = await agregar(app, comoCliente('token-invalido'), IDVariante);

    expect(respuesta.status).toBe(401);
    expect(cookieCarrito(respuesta)).toBeUndefined();
  });
});

describe('cantidades y existencia (E4-H01, N-06)', () => {
  it('agregar una variante que ya está en el carrito suma la cantidad', async () => {
    const { IDVariante } = await varianteVendible('10.00', 10);
    const { token } = await invitadoConCarrito(app, IDVariante, 2);

    const respuesta = await agregar(app, comoInvitado(token), IDVariante, 3);

    expect(leerCarrito(respuesta).lineas).toMatchObject([{ idVariante: IDVariante, cantidad: 5 }]);
  });

  it('si la suma pasa de lo disponible responde STOCK_INSUFICIENTE con el disponible y no cambia nada', async () => {
    const { IDVariante } = await varianteVendible('10.00', 5);
    const { token } = await invitadoConCarrito(app, IDVariante, 3);

    const respuesta = await agregar(app, comoInvitado(token), IDVariante, 3);

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta)).toMatchObject({
      codigo: 'STOCK_INSUFICIENTE',
      detalles: [{ idVariante: IDVariante, disponible: 5, enCarrito: 3 }],
    });
    expect(primeraLinea(leerCarrito(await verCarrito(app, comoInvitado(token)))).cantidad).toBe(3);
  });

  it('no se puede agregar más de lo disponible y un invitado nuevo no deja un carrito vacío', async () => {
    const { IDVariante } = await varianteVendible('10.00', 10);

    const respuesta = await agregar(app, comoInvitado(), IDVariante, 11);

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta).codigo).toBe('STOCK_INSUFICIENTE');
    expect(cookieCarrito(respuesta)).toBeUndefined();
  });

  it('PATCH cambia la cantidad; por encima de lo disponible responde 409 y no cambia', async () => {
    const { IDVariante } = await varianteVendible('10.00', 6);
    const { token, carrito } = await invitadoConCarrito(app, IDVariante, 1);
    const { idLinea } = primeraLinea(carrito);

    const cambio = await cambiarCantidad(app, comoInvitado(token), idLinea, 6);
    const excedido = await cambiarCantidad(app, comoInvitado(token), idLinea, 7);

    expect(primeraLinea(leerCarrito(cambio)).cantidad).toBe(6);
    expect(excedido.status).toBe(409);
    expect(leerError(excedido)).toMatchObject({
      codigo: 'STOCK_INSUFICIENTE',
      detalles: [{ idVariante: IDVariante, disponible: 6, enCarrito: 6 }],
    });
  });

  it.each([0, -1, 1.5, '2', 1_000_001])('PATCH con cantidad %s responde 400', async (cantidad) => {
    const { IDVariante } = await varianteVendible();
    const { token, carrito } = await invitadoConCarrito(app, IDVariante);

    const respuesta = await request(app)
      .patch(`/api/v1/carrito/lineas/${String(primeraLinea(carrito).idLinea)}`)
      .set(comoInvitado(token))
      .send({ cantidad });

    expect(respuesta.status).toBe(400);
    expect(leerError(respuesta).codigo).toBe('VALIDACION_FALLIDA');
  });

  it('POST rechaza campos extra y cantidades fuera de rango', async () => {
    const { IDVariante } = await varianteVendible();

    const respuestas = await Promise.all([
      request(app).post('/api/v1/carrito/lineas').send({ idVariante: IDVariante, cantidad: 0 }),
      request(app)
        .post('/api/v1/carrito/lineas')
        .send({ idVariante: IDVariante, cantidad: 1, idCarrito: 1 }),
      request(app).post('/api/v1/carrito/lineas').send({ idVariante: 'x', cantidad: 1 }),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([400, 400, 400]);
  });

  it('una variante inexistente o sin precio responde 404', async () => {
    const respuesta = await agregar(app, comoInvitado(), ID_INEXISTENTE);

    expect(respuesta.status).toBe(404);
  });

  it('una variante de un producto desactivado no se puede agregar (404)', async () => {
    const { IDProducto, IDVariante } = await varianteVendible();
    await desactivar('productos', IDProducto);

    const respuesta = await agregar(app, comoInvitado(), IDVariante);

    expect(respuesta.status).toBe(404);
  });

  it('CantidadExcedida y Agotado: la cantidad nunca se corrige sola y el carrito no se puede pagar', async () => {
    const { IDVariante } = await varianteVendible('10.00', 10);
    const { token } = await invitadoConCarrito(app, IDVariante, 4);

    await fijarExistencia(IDVariante, 2);
    const excedida = leerCarrito(await verCarrito(app, comoInvitado(token)));
    await fijarExistencia(IDVariante, 0);
    const agotada = leerCarrito(await verCarrito(app, comoInvitado(token)));

    expect(primeraLinea(excedida)).toMatchObject({
      cantidad: 4,
      estado: 'CantidadExcedida',
      ajustarA: 2,
      existencia: { estado: 'UltimasUnidades', unidadesRestantes: 2 },
    });
    expect(excedida.resumen.puedePagar).toBe(false);
    expect(primeraLinea(agotada)).toMatchObject({
      cantidad: 4,
      estado: 'Agotado',
      ajustarA: null,
      existencia: { estado: 'Agotado', unidadesRestantes: null },
    });
  });

  it('sobre el umbral no muestra la cifra de existencia (N-06)', async () => {
    const { IDVariante } = await varianteVendible('10.00', 50);

    const { carrito } = await invitadoConCarrito(app, IDVariante);

    expect(primeraLinea(carrito)).toMatchObject({
      estado: 'Disponible',
      ajustarA: null,
      existencia: { estado: 'Disponible', unidadesRestantes: null },
    });
    expect(carrito.resumen.puedePagar).toBe(true);
  });

  it.each(['productos', 'variantes'] as const)(
    'si se desactivan los %s, la línea queda NoDisponible y solo se puede eliminar',
    async (recurso) => {
      const { IDProducto, IDVariante } = await varianteVendible();
      const { token, carrito } = await invitadoConCarrito(app, IDVariante, 2);
      const { idLinea } = primeraLinea(carrito);
      await desactivar(recurso, recurso === 'productos' ? IDProducto : IDVariante);

      const consulta = leerCarrito(await verCarrito(app, comoInvitado(token)));
      const cambio = await cambiarCantidad(app, comoInvitado(token), idLinea, 1);
      const alta = await agregar(app, comoInvitado(token), IDVariante);
      const baja = await quitarLinea(app, comoInvitado(token), idLinea);

      expect(primeraLinea(consulta)).toMatchObject({ cantidad: 2, estado: 'NoDisponible' });
      expect(consulta.resumen.puedePagar).toBe(false);
      expect(cambio.status).toBe(409);
      expect(leerError(cambio).codigo).toBe('LINEAS_NO_DISPONIBLES');
      expect(alta.status).toBe(404);
      expect(baja.status).toBe(200);
      expect(leerCarrito(baja).lineas).toEqual([]);
    },
  );
});

describe('aislamiento entre carritos (E4-H01, RF-01)', () => {
  it('la línea de otro cliente responde 404 en PATCH y DELETE, y no cambia', async () => {
    const { IDVariante } = await varianteVendible();
    const duena = await clienteNuevo(app);
    const otro = await clienteNuevo(app);
    const { idLinea } = primeraLinea(
      leerCarrito(await agregar(app, comoCliente(duena.token), IDVariante, 2)),
    );

    const cambio = await cambiarCantidad(app, comoCliente(otro.token), idLinea, 1);
    const baja = await quitarLinea(app, comoCliente(otro.token), idLinea);

    expect([cambio.status, baja.status]).toEqual([404, 404]);
    expect(
      primeraLinea(leerCarrito(await verCarrito(app, comoCliente(duena.token)))).cantidad,
    ).toBe(2);
  });

  it('la línea de un invitado responde 404 a otro invitado, a un cliente y sin cookie', async () => {
    const { IDVariante } = await varianteVendible();
    const duena = await invitadoConCarrito(app, IDVariante);
    const otro = await invitadoConCarrito(app, (await varianteVendible()).IDVariante);
    const cliente = await clienteNuevo(app);
    const { idLinea } = primeraLinea(duena.carrito);

    const respuestas = await Promise.all([
      cambiarCantidad(app, comoInvitado(otro.token), idLinea, 1),
      quitarLinea(app, comoInvitado(otro.token), idLinea),
      quitarLinea(app, comoCliente(cliente.token), idLinea),
      quitarLinea(app, comoInvitado(), idLinea),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([404, 404, 404, 404]);
    expect(leerCarrito(await verCarrito(app, comoInvitado(duena.token))).lineas).toHaveLength(1);
  });
});

describe('totales (E4-H01, RF-04)', () => {
  it('cuadran al centavo con DECIMAL y viajan como texto', async () => {
    const { IDVariante: diezCentavos } = await varianteVendible('0.10', 10);
    const { IDVariante: tercio } = await varianteVendible('33.33', 10);
    const { token } = await invitadoConCarrito(app, diezCentavos, 3);

    const carrito = leerCarrito(await agregar(app, comoInvitado(token), tercio, 3));

    expect(carrito.lineas.map((l) => [l.precioUnitario, l.totalLinea])).toEqual([
      ['0.10', '0.30'],
      ['33.33', '99.99'],
    ]);
    expect(carrito.resumen).toEqual({
      lineas: 2,
      unidades: 6,
      subtotal: '100.29',
      descuento: '0.00',
      total: '100.29',
      puedePagar: true,
      cupon: null,
      cuponRetirado: null,
    });
  });
});

describe('límite de líneas (E4-H01, N-05)', () => {
  it(
    'admite 50 líneas: la 51 responde 422 LIMITE_LINEAS y sumar a una existente sigue funcionando',
    async () => {
      const variantes = await variantesVendibles('1.00', 5, 51);
      const cliente = await clienteNuevo(app);
      for (const { IDVariante } of variantes.slice(0, 50)) {
        expect((await agregar(app, comoCliente(cliente.token), IDVariante)).status).toBe(200);
      }

      const excedida = await agregar(
        app,
        comoCliente(cliente.token),
        variantes[50]?.IDVariante ?? 0,
      );
      const suma = await agregar(app, comoCliente(cliente.token), variantes[0]?.IDVariante ?? 0);

      expect(excedida.status).toBe(422);
      expect(leerError(excedida).codigo).toBe('LIMITE_LINEAS');
      expect(suma.status).toBe(200);
      expect(leerCarrito(suma).resumen.lineas).toBe(50);
    },
    TIMEOUT_CARRITO_LLENO_MS,
  );
});

describe('concurrencia (E4-H01, 01 §6.6)', () => {
  it('diez primeras altas simultáneas del mismo cliente crean un solo carrito con las diez líneas', async () => {
    const variantes = await variantesVendibles('1.00', 5, 10);
    const cliente = await clienteNuevo(app);

    const respuestas = await Promise.all(
      variantes.map(({ IDVariante }) => agregar(app, comoCliente(cliente.token), IDVariante)),
    );

    expect(respuestas.map((r) => r.status)).toEqual(Array(10).fill(200));
    expect(await carritosDelCliente(cliente.idUsuario)).toMatchObject([
      { Estado: 'Activo', Lineas: 10 },
    ]);
  });

  it(
    'con 49 líneas, de cinco altas simultáneas de variantes nuevas solo entra una',
    async () => {
      const variantes = await variantesVendibles('1.00', 5, 54);
      const cliente = await clienteNuevo(app);
      for (const { IDVariante } of variantes.slice(0, 49)) {
        await agregar(app, comoCliente(cliente.token), IDVariante);
      }

      const respuestas = await Promise.all(
        variantes
          .slice(49)
          .map(({ IDVariante }) => agregar(app, comoCliente(cliente.token), IDVariante)),
      );

      expect(respuestas.filter((r) => r.status === 200)).toHaveLength(1);
      expect(respuestas.filter((r) => r.status === 422)).toHaveLength(4);
      expect(await carritosDelCliente(cliente.idUsuario)).toMatchObject([{ Lineas: 50 }]);
    },
    TIMEOUT_CARRITO_LLENO_MS,
  );

  it('cinco sumas simultáneas de 2 unidades con 5 disponibles nunca pasan de 5', async () => {
    const { IDVariante } = await varianteVendible('1.00', 5);
    const cliente = await clienteNuevo(app);
    await agregar(app, comoCliente(cliente.token), IDVariante, 1);

    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () => agregar(app, comoCliente(cliente.token), IDVariante, 2)),
    );

    expect(respuestas.filter((r) => r.status === 200)).toHaveLength(2);
    expect(respuestas.filter((r) => r.status === 409)).toHaveLength(3);
    const carrito = leerCarrito(await verCarrito(app, comoCliente(cliente.token)));
    expect(primeraLinea(carrito).cantidad).toBe(5);
  });
});

describe('rate limiting de carritos de invitado (E4-H01, 01 §5.3)', () => {
  function limitadorDeUnaCreacion() {
    const claves: string[] = [];
    const limitador: LimitadorIntentos = {
      consumir: (clave) => {
        claves.push(clave);
        const permitido = claves.filter((c) => c === clave).length <= 1;
        return Promise.resolve({ permitido, segundosParaReintentar: permitido ? 0 : 42 });
      },
    };
    return { claves, limitador };
  }

  it('limita la creación por IP con 429 y Retry-After; agregar a un carrito existente no consume', async () => {
    const [primera, segunda] = await variantesVendibles('1.00', 5, 2);
    const { claves, limitador } = limitadorDeUnaCreacion();
    const limitada = crearApp(
      dependenciasDePrueba({
        limitadores: {
          login: SIN_LIMITE,
          registro: SIN_LIMITE,
          cambioContrasena: SIN_LIMITE,
          carritoInvitado: limitador,
        },
      }),
    );

    const creacion = await agregar(limitada, comoInvitado(), primera?.IDVariante ?? 0);
    const otraCreacion = await agregar(limitada, comoInvitado(), primera?.IDVariante ?? 0);
    const existente = await agregar(
      limitada,
      comoInvitado(tokenCarrito(creacion)),
      segunda?.IDVariante ?? 0,
    );

    expect(creacion.status).toBe(200);
    expect(otraCreacion.status).toBe(429);
    expect(otraCreacion.headers['retry-after']).toBe('42');
    expect(cookieCarrito(otraCreacion)).toBeUndefined();
    expect(existente.status).toBe(200);
    expect(claves).toHaveLength(2);
    expect(claves[0]).toMatch(/(\d{1,3}\.){3}\d{1,3}|::/);
  });

  it('el cliente no consume el límite de invitados', async () => {
    const { IDVariante } = await varianteVendible();
    const { claves, limitador } = limitadorDeUnaCreacion();
    const limitada = crearApp(
      dependenciasDePrueba({
        limitadores: {
          login: SIN_LIMITE,
          registro: SIN_LIMITE,
          cambioContrasena: SIN_LIMITE,
          carritoInvitado: limitador,
        },
      }),
    );
    const cliente = await clienteNuevo(limitada);

    await agregar(limitada, comoCliente(cliente.token), IDVariante);

    expect(claves).toEqual([]);
  });
});

describe('los logs nunca llevan el token del carrito (E4-H01, N-05)', () => {
  it('ni el token ni su hash aparecen en los logs de un flujo completo de invitado', async () => {
    const lineas: string[] = [];
    const destino = new Writable({
      write(fragmento: Buffer, _codificacion, listo) {
        lineas.push(fragmento.toString());
        listo();
      },
    });
    const conLogs = crearApp(
      dependenciasDePrueba({ logger: crearLogger({ nivel: 'debug', destino }) }),
    );
    const { IDVariante } = await varianteVendible('10.00', 3);

    const alta = await agregar(conLogs, comoInvitado(), IDVariante);
    const token = tokenCarrito(alta);
    const { idLinea } = primeraLinea(leerCarrito(alta));
    await agregar(conLogs, comoInvitado(token), IDVariante, 5);
    await cambiarCantidad(conLogs, comoInvitado(token), idLinea, 2);
    await verCarrito(conLogs, comoInvitado(token));
    await quitarLinea(conLogs, comoInvitado(token), idLinea);

    const log = lineas.join('');
    expect(log.length).toBeGreaterThan(0);
    expect(log).not.toContain(token);
    expect(log).not.toContain(hashDe(token).toString('hex'));
    expect(log).not.toContain(hashDe(token).toString('base64'));
  });
});
