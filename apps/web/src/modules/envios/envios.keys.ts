export const enviosKeys = {
  todo: ['envios'] as const,
  paraCarrito: () => [...enviosKeys.todo, 'para-carrito'] as const,
  admin: () => [...enviosKeys.todo, 'admin'] as const,
};
