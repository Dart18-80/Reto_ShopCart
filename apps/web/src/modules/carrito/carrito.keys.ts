export const carritoKeys = {
  todo: ['carrito'] as const,
  carrito: () => [...carritoKeys.todo, 'actual'] as const,
};
