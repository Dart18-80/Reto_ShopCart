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

export type Area = 'tienda' | 'cuenta' | 'backoffice';

/** Los grupos de la barra lateral del backoffice (Figma, Barra lateral backoffice). */
export type GrupoMenu = 'Ventas' | 'Catálogo' | 'Administración';

export interface EntradaMenu {
  etiqueta: string;
  grupo?: GrupoMenu;
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
  tienda: '/',
  cuenta: '/cuenta',
  backoffice: '/backoffice',
};

export const RUTA_CARRITO = '/carrito';

/** Carga diferida de una página exportada con nombre: el paquete de cada página se descarga al visitarla. */
const diferida = <M>(cargar: () => Promise<M>, elegir: (modulo: M) => ComponentType) =>
  lazy(async () => ({ default: elegir(await cargar()) }));

/**
 * FE-04: la única definición de las páginas, de la que salen el guardián y los menús. Los accesos reflejan el
 * `autorizar(...)` de cada ruta del backend. Las páginas son marcadores hasta la historia de su módulo.
 */
export const PAGINAS: readonly DefinicionPagina[] = [
  {
    ruta: '/',
    area: 'tienda',
    acceso: PUBLICO,
    menu: { etiqueta: 'Catálogo' },
    pagina: diferida(
      () => import('../modules/catalogo/paginas/CatalogoPagina'),
      (m) => m.CatalogoPagina,
    ),
  },
  {
    ruta: RUTA_CARRITO,
    area: 'tienda',
    acceso: INVITADO_O_CLIENTE,
    pagina: diferida(
      () => import('../modules/carrito/paginas/CarritoPagina'),
      (m) => m.CarritoPagina,
    ),
  },
  {
    ruta: '/checkout',
    area: 'tienda',
    acceso: SOLO_CLIENTE,
    pagina: diferida(
      () => import('../modules/checkout/paginas/CheckoutPagina'),
      (m) => m.CheckoutPagina,
    ),
  },
  {
    ruta: '/pedidos',
    area: 'tienda',
    acceso: SOLO_CLIENTE,
    menu: { etiqueta: 'Mis pedidos' },
    pagina: diferida(
      () => import('../modules/pedidos/paginas/MisPedidosPagina'),
      (m) => m.MisPedidosPagina,
    ),
  },
  {
    ruta: '/ingresar',
    area: 'tienda',
    acceso: PUBLICO,
    pagina: diferida(
      () => import('../modules/auth/paginas/IngresarPagina'),
      (m) => m.IngresarPagina,
    ),
  },
  {
    ruta: '/cuenta/perfil',
    area: 'cuenta',
    acceso: CON_SESION,
    menu: { etiqueta: 'Perfil' },
    pagina: diferida(
      () => import('../modules/usuarios/paginas/PerfilPagina'),
      (m) => m.PerfilPagina,
    ),
  },
  {
    ruta: '/cuenta/direcciones',
    area: 'cuenta',
    acceso: SOLO_CLIENTE,
    menu: { etiqueta: 'Direcciones' },
    pagina: diferida(
      () => import('../modules/direcciones/paginas/DireccionesPagina'),
      (m) => m.DireccionesPagina,
    ),
  },
  {
    ruta: '/backoffice/dashboard',
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Dashboard', grupo: 'Ventas' },
    pagina: diferida(
      () => import('../modules/reportes/paginas/DashboardPagina'),
      (m) => m.DashboardPagina,
    ),
  },
  {
    ruta: '/backoffice/pedidos',
    area: 'backoffice',
    acceso: PERSONAL,
    menu: { etiqueta: 'Pedidos', grupo: 'Ventas' },
    pagina: diferida(
      () => import('../modules/pedidos/paginas/GestionPedidosPagina'),
      (m) => m.GestionPedidosPagina,
    ),
  },
  {
    ruta: '/backoffice/pagos-en-revision',
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Pagos en revisión', grupo: 'Ventas' },
    pagina: diferida(
      () => import('../modules/pedidos/paginas/PagosEnRevisionPagina'),
      (m) => m.PagosEnRevisionPagina,
    ),
  },
  {
    ruta: '/backoffice/reembolsos',
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Reembolsos', grupo: 'Ventas' },
    pagina: diferida(
      () => import('../modules/pedidos/paginas/ReembolsosPagina'),
      (m) => m.ReembolsosPagina,
    ),
  },
  {
    ruta: '/backoffice/exportaciones',
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Exportaciones', grupo: 'Ventas' },
    pagina: diferida(
      () => import('../modules/exportaciones/paginas/ExportacionesPagina'),
      (m) => m.ExportacionesPagina,
    ),
  },
  {
    ruta: '/backoffice/catalogo',
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Productos y precios', grupo: 'Catálogo' },
    pagina: diferida(
      () => import('../modules/catalogo/paginas/GestionCatalogoPagina'),
      (m) => m.GestionCatalogoPagina,
    ),
  },
  {
    ruta: '/backoffice/inventario',
    area: 'backoffice',
    acceso: PERSONAL,
    menu: { etiqueta: 'Inventario', grupo: 'Catálogo' },
    pagina: diferida(
      () => import('../modules/inventario/paginas/InventarioPagina'),
      (m) => m.InventarioPagina,
    ),
  },
  {
    ruta: '/backoffice/cupones',
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Cupones', grupo: 'Catálogo' },
    pagina: diferida(
      () => import('../modules/cupones/paginas/CuponesPagina'),
      (m) => m.CuponesPagina,
    ),
  },
  {
    ruta: '/backoffice/envios',
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Envíos', grupo: 'Administración' },
    pagina: diferida(
      () => import('../modules/envios/paginas/MetodosEnvioPagina'),
      (m) => m.MetodosEnvioPagina,
    ),
  },
  {
    ruta: '/backoffice/configuracion',
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Configuración', grupo: 'Administración' },
    pagina: diferida(
      () => import('../modules/configuracion/paginas/ConfiguracionPagina'),
      (m) => m.ConfiguracionPagina,
    ),
  },
  {
    ruta: '/backoffice/usuarios',
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Usuarios', grupo: 'Administración' },
    pagina: diferida(
      () => import('../modules/usuarios/paginas/UsuariosPagina'),
      (m) => m.UsuariosPagina,
    ),
  },
  {
    ruta: '/backoffice/bitacora',
    area: 'backoffice',
    acceso: SOLO_ADMINISTRADOR,
    menu: { etiqueta: 'Bitácora', grupo: 'Administración' },
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
