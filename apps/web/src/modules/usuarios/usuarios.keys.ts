export const usuariosKeys = {
  todo: ['usuarios'] as const,
  perfil: () => [...usuariosKeys.todo, 'perfil'] as const,
};
