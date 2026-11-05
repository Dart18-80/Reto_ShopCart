// API pública del módulo carrito: el detalle de producto agrega líneas, el encabezado muestra la cantidad y el
// checkout (M4-H02) resume el carrito.
export type { Carrito } from './carrito.api';
export { carritoKeys } from './carrito.keys';
export { ContadorCarrito } from './componentes/ContadorCarrito';
export { useAgregarAlCarrito } from './hooks/useOperacionesDelCarrito';
export { useCarrito } from './hooks/useCarrito';
