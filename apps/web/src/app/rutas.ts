import {
  Boxes,
  FileDown,
  LayoutDashboard,
  MapPin,
  Package,
  ScrollText,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Store,
  Tag,
  TicketPercent,
  Truck,
  Undo2,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { EstadoSesion } from '../shared/api';
import {
  CON_SESION,
  INVITADO_O_CLIENTE,
  PERSONAL,
  permisoPara,
  PUBLICO,
  SOLO_ADMINISTRADOR,
  SOLO_CLIENTE,
  type Acceso,
} from './acceso';
import { RUTAS } from '../shared/rutas';

export type Area = 'tienda' | 'cuenta' | 'backoffice';

/** Los grupos de la barra lateral del backoffice (Figma, Barra lateral backoffice). */
export type GrupoMenu = 'Ventas' | 'Catálogo' | 'Administración';

export interface EntradaMenu {
  etiqueta: string;
  grupo?: GrupoMenu;
  /** D6: el ícono de la opción (lucide), decorativo: la etiqueta es el nombre. */
  icono: LucideIcon;
}

export interface DefinicionPagina {
  ruta: string;
  area: Area;
  acceso: Acceso;
  menu?: EntradaMenu;
  pagina: LazyExoticComponent<ComponentType>;
}

export const ACCESO_DE_AREA: Record<Area, Acceso> = {
  tienda: PUBLICO,
  cuenta: CON_SESION,
  backoffice: PERSONAL,
};

export const RAIZ_DE_AREA: Record<Area, string> = {
  tienda: RUTAS.catalogo,
  cuenta: RUTAS.cuenta,
  backoffice: RUTAS.backoffice,
};

/** Carga diferida de una página exportada con nombre: el paquete de cada página se descarga al visitarla. */
const diferida = <M>(cargar: () => Promise<M>, elegir: (modulo: M) => ComponentType) =>
  lazy(async () => ({ default: elegir(await cargar()) }));

/**
 * FE-04: la única definición de las páginas, de la que salen el guardián y los menús. Los accesos reflejan el
 * `autorizar(...)` de cada ruta del backend. Las páginas son marcadores hasta la historia de su módulo.
 */
export const PAGINAS: readonly DefinicionPagina[] = [
  {
    ruta: RUTAS.catalogo,
    area: 'tienda',
    acceso: PUBLICO,
    menu: { etiqueta: 'Catálogo', icono: Store },
    pagina: diferida(
      () => import('../modules/catalogo/paginas/CatalogoPagina'),
      (m) => m.CatalogoPagina,
    ),
  },
  {
    ruta: RUTAS.producto,
    area: 'tienda',
    acceso: PUBLICO,
    pagina: diferida(
      () => import('../modules/catalogo/paginas/ProductoPagina'),
      (m) => m.ProductoPagina,
    ),
  },
  {
    ruta: RUTAS.carrito,
    area: 'tienda',
    acceso: INVITADO_O_CLIENTE,
    pagina: diferida(
      () => import('../modules/carrito/paginas/CarritoPagina'),
      (m) => m.CarritoPagina,
    ),
  },
  {
    ruta: RUTAS.checkout,
    area: 'tienda',
    acceso: SOLO_CLIENTE,
    pagina: diferida(
      () => import('../modules/checkout/paginas/CheckoutPagina'),
      (m) => m.CheckoutPagina,
    ),
  },
  {
    ruta: RUTAS.pago,
    area: 'tienda',
    acceso: SOLO_CLIENTE,
    pagina: diferida(
      () => import('../modules/checkout/paginas/PagoPagina'),
      (m) => m.PagoPagina,
    ),
  },
  {
    ruta: RUTAS.misPedidos,
    area: 'tienda',
    acceso: SOLO_CLIENTE,
    menu: { etiqueta: 'Mis pedidos', icono: Package },
    pagina: diferida(
      () => import('../modules/pedidos/paginas/MisPedidosPagina'),
      (m) => m.MisPedidosPagina,
    ),
  },
  {
    ruta: RUTAS.pedido,
    area: 'tienda',
    acceso: SOLO_CLIENTE,
    pagina: diferida(
      () => import('../modules/pedidos/paginas/PedidoPagina'),
      (m) => m.PedidoPagina,
    ),
  },
  {
    ruta: RUTAS.ingresar,
    area: 'tienda',
    acceso: PUBLICO,
    pagina: diferida(
      () => import('../modules/auth/paginas/IngresarPagina'),
      (m) => m.IngresarPagina,
    ),
  },
  {
    ruta: RUTAS.registro,
    area: 'tienda',
    acceso: PUBLICO,
    pagina: diferida(
      () => import('../modules/auth/paginas/RegistroPagina'),
      (m) => m.RegistroPagina,
    ),
  },
  {
    ruta: RUTAS.perfil,
    area: 'cuenta',
    acceso: CON_SESION,
    menu: { etiqueta: 'Perfil', icono: UserRound },
    pagina: diferida(
      () => import('../modules/usuarios/paginas/PerfilPagina'),
      (m) => m.PerfilPagina,
    ),
  },
  {
    ruta: RUTAS.direcciones,
    area: 'cuenta',
    acceso: SOLO_CLIENTE,
    menu: { etiqueta: 'Direcciones', icono: MapPin },
    pagina: diferida(
      () => import('../modules/direcciones/paginas/DireccionesPagina'),
      (m) => m.DireccionesPagina,
    ),
  },
  {
    ruta: RUTAS.dashboard,
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Dashboard', grupo: 'Ventas', icono: LayoutDashboard },
    pagina: diferida(
      () => import('../modules/reportes/paginas/DashboardPagina'),
      (m) => m.DashboardPagina,
    ),
  },
  {
    ruta: RUTAS.gestionPedidos,
    area: 'backoffice',
    acceso: PERSONAL,
    menu: { etiqueta: 'Pedidos', grupo: 'Ventas', icono: ShoppingBag },
    pagina: diferida(
      () => import('../modules/pedidos/paginas/GestionPedidosPagina'),
      (m) => m.GestionPedidosPagina,
    ),
  },
  {
    ruta: RUTAS.pedidoGestion,
    area: 'backoffice',
    acceso: PERSONAL,
    pagina: diferida(
      () => import('../modules/pedidos/paginas/PedidoGestionPagina'),
      (m) => m.PedidoGestionPagina,
    ),
  },
  {
    ruta: RUTAS.pagosEnRevision,
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Pagos en revisión', grupo: 'Ventas', icono: ShieldAlert },
    pagina: diferida(
      () => import('../modules/pedidos/paginas/PagosEnRevisionPagina'),
      (m) => m.PagosEnRevisionPagina,
    ),
  },
  {
    ruta: RUTAS.reembolsos,
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Reembolsos', grupo: 'Ventas', icono: Undo2 },
    pagina: diferida(
      () => import('../modules/pedidos/paginas/ReembolsosPagina'),
      (m) => m.ReembolsosPagina,
    ),
  },
  {
    ruta: RUTAS.exportaciones,
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Exportaciones', grupo: 'Ventas', icono: FileDown },
    pagina: diferida(
      () => import('../modules/exportaciones/paginas/ExportacionesPagina'),
      (m) => m.ExportacionesPagina,
    ),
  },
  {
    ruta: RUTAS.gestionCatalogo,
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Productos y precios', grupo: 'Catálogo', icono: Tag },
    pagina: diferida(
      () => import('../modules/catalogo/paginas/GestionCatalogoPagina'),
      (m) => m.GestionCatalogoPagina,
    ),
  },
  {
    ruta: RUTAS.productoAdmin,
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    pagina: diferida(
      () => import('../modules/catalogo/paginas/ProductoAdminPagina'),
      (m) => m.ProductoAdminPagina,
    ),
  },
  {
    // M6-H02: se llega con el botón «Categorías y atributos» de Productos y precios (Figma 48:1169), sin menú.
    ruta: RUTAS.categorias,
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    pagina: diferida(
      () => import('../modules/catalogo/paginas/CategoriasPagina'),
      (m) => m.CategoriasPagina,
    ),
  },
  {
    ruta: RUTAS.inventario,
    area: 'backoffice',
    acceso: PERSONAL,
    menu: { etiqueta: 'Inventario', grupo: 'Catálogo', icono: Boxes },
    pagina: diferida(
      () => import('../modules/inventario/paginas/InventarioPagina'),
      (m) => m.InventarioPagina,
    ),
  },
  {
    ruta: RUTAS.cupones,
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Cupones', grupo: 'Catálogo', icono: TicketPercent },
    pagina: diferida(
      () => import('../modules/cupones/paginas/CuponesPagina'),
      (m) => m.CuponesPagina,
    ),
  },
  {
    ruta: RUTAS.envios,
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Envíos', grupo: 'Administración', icono: Truck },
    pagina: diferida(
      () => import('../modules/envios/paginas/MetodosEnvioPagina'),
      (m) => m.MetodosEnvioPagina,
    ),
  },
  {
    ruta: RUTAS.configuracion,
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Configuración', grupo: 'Administración', icono: Settings },
    pagina: diferida(
      () => import('../modules/configuracion/paginas/ConfiguracionPagina'),
      (m) => m.ConfiguracionPagina,
    ),
  },
  {
    ruta: RUTAS.usuarios,
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Usuarios', grupo: 'Administración', icono: Users },
    pagina: diferida(
      () => import('../modules/usuarios/paginas/UsuariosPagina'),
      (m) => m.UsuariosPagina,
    ),
  },
  {
    ruta: RUTAS.bitacora,
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Bitácora', grupo: 'Administración', icono: ScrollText },
    pagina: diferida(
      () => import('../modules/bitacora/paginas/BitacoraPagina'),
      (m) => m.BitacoraPagina,
    ),
  },
];

/** Si esta sesión puede abrir una ruta de la definición (el encabezado lo usa para el carrito). */
export function puedeAbrir(ruta: string, estado: EstadoSesion): boolean {
  const pagina = PAGINAS.find((p) => p.ruta === ruta);
  return pagina !== undefined && permisoPara(pagina.acceso, estado) === 'permitido';
}

export interface PaginaDeMenu extends DefinicionPagina {
  menu: EntradaMenu;
}

/** Las entradas del menú de un área que esta sesión puede abrir, en el orden de la definición. */
export function menuDe(area: Area, estado: EstadoSesion): PaginaDeMenu[] {
  return PAGINAS.filter(
    (pagina): pagina is PaginaDeMenu =>
      pagina.area === area &&
      pagina.menu !== undefined &&
      permisoPara(pagina.acceso, estado) === 'permitido',
  );
}
