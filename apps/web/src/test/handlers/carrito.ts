import { delay, http, HttpResponse } from 'msw';
import type { Respuesta } from '../../shared/api';
import { servidor } from '../servidor';

type Carrito = Respuesta<'/api/v1/carrito', 'get'>['datos'];
type LineaCarrito = Carrito['lineas'][number];

export const lineaDePrueba = (cambios: Partial<LineaCarrito> = {}): LineaCarrito => ({
  idLinea: 1,
  idVariante: 10,
  idProducto: 5,
  producto: 'Camisa Oxford',
  sku: 'OXF-M-AZ',
  descripcionAtributos: 'Azul / M',
  imagen: null,
  ilustracion: 'Camisa',
  color: 'Azul',
  cantidad: 2,
  precioUnitario: '249.00',
  totalLinea: '498.00',
  totalComprable: '498.00',
  descuentoLinea: '0.00',
  estado: 'Disponible',
  ajustarA: null,
  existencia: { estado: 'Disponible', unidadesRestantes: null },
  garantiaHasta: '2026-11-09T05:30:00.000Z',
  aviso: null,
  ...cambios,
});

export const carritoDePrueba = (
  lineas: LineaCarrito[] = [lineaDePrueba()],
  resumen: Partial<Carrito['resumen']> = {},
): Carrito => ({
  lineas,
  resumen: {
    lineas: lineas.length,
    unidades: lineas.reduce((unidades, linea) => unidades + linea.cantidad, 0),
    subtotal: '498.00',
    descuento: '0.00',
    total: '498.00',
    puedePagar: true,
    cupon: null,
    cuponRetirado: null,
    envioGratis: null,
    ...resumen,
  },
});

const RUTA = '/api/v1/carrito';

/** `GET /carrito` con el carrito indicado. */
export function simularCarrito(carrito: Carrito = carritoDePrueba()) {
  servidor.use(http.get(RUTA, () => HttpResponse.json({ datos: carrito })));
}

export function simularCarritoFallido(requestId: string) {
  servidor.use(
    http.get(RUTA, () =>
      HttpResponse.json(
        { error: { codigo: 'ERROR_INTERNO', mensaje: 'No pudimos cargar tu carrito.', requestId } },
        { status: 500 },
      ),
    ),
  );
}

type Metodo = 'post' | 'put' | 'patch' | 'delete';

/**
 * Una operación del carrito que responde el carrito nuevo, como el backend; guarda lo que recibió. Con `demora`,
 * deja ver la línea mientras espera la respuesta.
 */
export function simularOperacion(
  metodo: Metodo,
  ruta: string,
  respuesta: Carrito,
  { demora = 0 }: { demora?: number } = {},
) {
  const recibidas: { cuerpo: unknown; url: string }[] = [];
  servidor.use(
    http[metodo](`${RUTA}${ruta}`, async ({ request }) => {
      const texto = await request.text();
      recibidas.push({
        cuerpo: texto === '' ? null : (JSON.parse(texto) as unknown),
        url: request.url,
      });
      await delay(demora);
      return HttpResponse.json({ datos: respuesta }, { status: metodo === 'post' ? 201 : 200 });
    }),
  );
  return recibidas;
}

export function simularOperacionFallida(
  metodo: Metodo,
  ruta: string,
  status: number,
  codigo: string,
  mensaje: string,
) {
  servidor.use(
    http[metodo](`${RUTA}${ruta}`, () =>
      HttpResponse.json({ error: { codigo, mensaje, requestId: 'req-carrito' } }, { status }),
    ),
  );
}
