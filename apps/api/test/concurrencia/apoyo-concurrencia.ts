import { randomUUID } from 'node:crypto';
import { z } from 'zod';

// RNF-3: la prueba corre contra el entorno de Docker a través de nginx, que reparte entre api-1 y api-2.
const URL_BASE = process.env.SHOPCART_URL ?? 'http://localhost:8080';
// S005: los 20 clientes sembrados para esta prueba (contraseña documentada en el README).
const CONTRASENA_CLIENTES = 'Concurrencia2026!';
export const TOTAL_CLIENTES = 20;
const TARJETA_APROBADA = '4242424242424242';

export interface Respuesta {
  status: number;
  cuerpo: unknown;
  /** La réplica que atendió la petición (cabecera X-Instancia). */
  instancia: string | null;
}

interface Opciones {
  token?: string;
  cuerpo?: unknown;
  encabezados?: Record<string, string>;
}

export async function api(
  metodo: string,
  ruta: string,
  opciones: Opciones = {},
): Promise<Respuesta> {
  const encabezados: Record<string, string> = { ...opciones.encabezados };
  if (opciones.token !== undefined) encabezados.Authorization = `Bearer ${opciones.token}`;
  if (opciones.cuerpo !== undefined) encabezados['Content-Type'] = 'application/json';
  const respuesta = await fetch(`${URL_BASE}/api/v1${ruta}`, {
    method: metodo,
    headers: encabezados,
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
  });
  const texto = await respuesta.text();
  const cuerpo: unknown = texto === '' ? null : JSON.parse(texto);
  return { status: respuesta.status, cuerpo, instancia: respuesta.headers.get('x-instancia') };
}

export function datos<T>(respuesta: Respuesta, esquema: z.ZodType<T>): T {
  const leido = z.object({ datos: esquema }).safeParse(respuesta.cuerpo);
  if (!leido.success) {
    throw new Error(
      `Respuesta inesperada (${String(respuesta.status)}): ${JSON.stringify(respuesta.cuerpo)}`,
    );
  }
  return leido.data.datos;
}

const errorSchema = z.object({ error: z.object({ codigo: z.string(), mensaje: z.string() }) });

export function error(respuesta: Respuesta): { codigo: string; mensaje: string } | null {
  const leido = errorSchema.safeParse(respuesta.cuerpo);
  return leido.success ? leido.data.error : null;
}

async function iniciarSesion(correo: string, contrasena: string): Promise<string> {
  const respuesta = await api('POST', '/auth/login', { cuerpo: { correo, contrasena } });
  return datos(respuesta, z.object({ accessToken: z.string() })).accessToken;
}

export const tokenDeAdmin = () => iniciarSesion('admin@shopcart.gt', 'Admin2026!');

const sufijo = () => randomUUID().slice(0, 8);

export interface VarianteDePrueba {
  idProducto: number;
  idVariante: number;
}

/** Una variante nueva y activa con la existencia dada, creada solo con la API de administración. */
export async function varianteConExistencia(
  token: string,
  existencia: number,
): Promise<VarianteDePrueba> {
  const { idCategoria } = datos(
    await api('POST', '/admin/categorias', {
      token,
      cuerpo: { nombre: `Concurrencia ${sufijo()}` },
    }),
    z.object({ idCategoria: z.number() }),
  );
  const { idAtributo } = datos(
    await api('POST', '/admin/atributos', { token, cuerpo: { nombre: `Talla ${sufijo()}` } }),
    z.object({ idAtributo: z.number() }),
  );
  const { idValorAtributo } = datos(
    await api('POST', `/admin/atributos/${String(idAtributo)}/valores`, {
      token,
      cuerpo: { valor: 'Única' },
    }),
    z.object({ idValorAtributo: z.number() }),
  );
  const { idProducto } = datos(
    await api('POST', '/admin/productos', {
      token,
      cuerpo: { idCategoria, nombre: `Producto concurrencia ${sufijo()}` },
    }),
    z.object({ idProducto: z.number() }),
  );
  const { variantes } = datos(
    await api('POST', `/admin/productos/${String(idProducto)}/variantes`, {
      token,
      cuerpo: { sku: `CONC-${sufijo()}`, valores: [idValorAtributo], precio: '25.00' },
    }),
    z.object({ variantes: z.array(z.object({ idVariante: z.number() })) }),
  );
  const idVariante = variantes[0]?.idVariante;
  if (idVariante === undefined) throw new Error('La variante no se creó');
  const entrada = await api('POST', '/inventario/entradas', {
    token,
    cuerpo: { idVariante, cantidad: existencia, motivo: 'Prueba de concurrencia' },
  });
  if (entrada.status !== 201) throw new Error(`La entrada falló (${String(entrada.status)})`);
  return { idProducto, idVariante };
}

/** La existencia física y el disponible de la variante, leídos de la API de administración. */
export async function existenciaDe(token: string, { idProducto, idVariante }: VarianteDePrueba) {
  const { variantes } = datos(
    await api('GET', `/admin/productos/${String(idProducto)}`, { token }),
    z.object({
      variantes: z.array(
        z.object({ idVariante: z.number(), existenciaFisica: z.number(), disponible: z.number() }),
      ),
    }),
  );
  const variante = variantes.find((v) => v.idVariante === idVariante);
  if (variante === undefined) throw new Error(`No se encontró la variante ${String(idVariante)}`);
  return variante;
}

export interface Cliente {
  token: string;
  idDireccion: number;
}

async function municipioCualquiera(): Promise<number> {
  const [departamento] = datos(
    await api('GET', '/departamentos'),
    z.array(z.object({ idDepartamento: z.number() })),
  );
  const [municipio] = datos(
    await api('GET', `/departamentos/${String(departamento?.idDepartamento)}/municipios`),
    z.array(z.object({ idMunicipio: z.number() })),
  );
  if (municipio === undefined) throw new Error('La semilla no tiene municipios');
  return municipio.idMunicipio;
}

async function direccionDe(token: string, idMunicipio: number): Promise<number> {
  const [existente] = datos(
    await api('GET', '/direcciones', { token }),
    z.array(z.object({ idDireccion: z.number() })),
  );
  if (existente !== undefined) return existente.idDireccion;
  return datos(
    await api('POST', '/direcciones', {
      token,
      cuerpo: {
        nombreRecibe: 'Cliente Concurrencia',
        telefonoRecibe: '55551234',
        idMunicipio,
        direccionLinea: '6a avenida 1-23',
      },
    }),
    z.object({ idDireccion: z.number() }),
  ).idDireccion;
}

/** Deja el carrito vacío y sin sesión de pago, para que una corrida anterior no influya en esta. */
async function limpiar(token: string): Promise<void> {
  await api('DELETE', '/checkout/sesion', { token });
  await api('DELETE', '/carrito/cupon', { token });
  const carrito = datos(
    await api('GET', '/carrito', { token }),
    z.object({ lineas: z.array(z.object({ idLinea: z.number() })) }),
  );
  for (const { idLinea } of carrito.lineas) {
    await api('DELETE', `/carrito/lineas/${String(idLinea)}`, { token });
  }
}

/**
 * Los 20 clientes de S005 con su dirección. Inician sesión una sola vez por corrida: el login tiene un
 * límite de 5 por minuto por IP y correo (A-07).
 */
export async function clientesSembrados(cantidad = TOTAL_CLIENTES): Promise<Cliente[]> {
  const idMunicipio = await municipioCualquiera();
  return Promise.all(
    Array.from({ length: cantidad }, async (_, indice) => {
      const correo = `concurrencia${String(indice + 1).padStart(2, '0')}@shopcart.gt`;
      const token = await iniciarSesion(correo, CONTRASENA_CLIENTES);
      return { token, idDireccion: await direccionDe(token, idMunicipio) };
    }),
  );
}

/** Carritos vacíos y sin sesión de pago, para que un escenario o una corrida anterior no influya. */
export async function limpiarCarritos(clientes: Cliente[]): Promise<void> {
  await Promise.all(clientes.map(({ token }) => limpiar(token)));
}

export async function metodoEstandar(): Promise<number> {
  const { metodos } = datos(
    await api('GET', '/envios/metodos'),
    z.object({ metodos: z.array(z.object({ idMetodoEnvio: z.number(), codigo: z.string() })) }),
  );
  const estandar = metodos.find((metodo) => metodo.codigo === 'Estandar');
  if (estandar === undefined) throw new Error('Falta el método Estandar');
  return estandar.idMetodoEnvio;
}

export interface Intento {
  /** La respuesta final: el pago si la sesión se creó, o el rechazo al iniciarla. */
  final: Respuesta;
  instancias: (string | null)[];
}

/** RF-06: iniciar la sesión de pago (reserva todo o nada) y, si se pudo, pagar. */
export async function comprar(cliente: Cliente, idMetodoEnvio: number): Promise<Intento> {
  const sesion = await api('POST', '/checkout/sesion', {
    token: cliente.token,
    cuerpo: { idDireccion: cliente.idDireccion, idMetodoEnvio },
  });
  if (sesion.status !== 201) return { final: sesion, instancias: [sesion.instancia] };
  const pago = await api('POST', '/checkout/sesion/pagos', {
    token: cliente.token,
    encabezados: { 'Idempotency-Key': randomUUID() },
    cuerpo: {
      numeroTarjeta: TARJETA_APROBADA,
      mesVencimiento: 12,
      anioVencimiento: 2030,
      cvv: '123',
    },
  });
  return { final: pago, instancias: [sesion.instancia, pago.instancia] };
}
