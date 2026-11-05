export const checkoutKeys = {
  todo: ['checkout'] as const,
  sesion: () => [...checkoutKeys.todo, 'sesion'] as const,
};
