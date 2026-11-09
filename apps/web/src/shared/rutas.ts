/**
 * FE-04: las rutas de la SPA en un solo lugar. `app/rutas.ts` define con ellas las páginas (y de ahí salen el guardián
 * y los menús) y los módulos enlazan con ellas: si una cambia, cambia en todos lados. Una prueba verifica que cada
 * una sea una página o la raíz de un área.
 */
export const RUTAS = {
  catalogo: '/',
  producto: '/productos/:id',
  carrito: '/carrito',
  checkout: '/checkout',
  pago: '/checkout/pago',
  misPedidos: '/pedidos',
  pedido: '/pedidos/:id',
  ingresar: '/ingresar',
  registro: '/registro',
  cuenta: '/cuenta',
  perfil: '/cuenta/perfil',
  direcciones: '/cuenta/direcciones',
  backoffice: '/backoffice',
  dashboard: '/backoffice/dashboard',
  gestionPedidos: '/backoffice/pedidos',
  pedidoGestion: '/backoffice/pedidos/:id',
  pagosEnRevision: '/backoffice/pagos-en-revision',
  reembolsos: '/backoffice/reembolsos',
  exportaciones: '/backoffice/exportaciones',
  gestionCatalogo: '/backoffice/catalogo',
  productoAdmin: '/backoffice/catalogo/productos/:id',
  categorias: '/backoffice/catalogo/categorias',
  inventario: '/backoffice/inventario',
  cupones: '/backoffice/cupones',
  envios: '/backoffice/envios',
  configuracion: '/backoffice/configuracion',
  usuarios: '/backoffice/usuarios',
  bitacora: '/backoffice/bitacora',
} as const;

type Ruta = (typeof RUTAS)[keyof typeof RUTAS];
type RutaConId = Extract<Ruta, `${string}:id`>;

/** La URL de una ruta con `:id`: `conId(RUTAS.pedido, 7)` → `/pedidos/7`. */
export const conId = (ruta: RutaConId, id: number): string => ruta.replace(':id', String(id));
