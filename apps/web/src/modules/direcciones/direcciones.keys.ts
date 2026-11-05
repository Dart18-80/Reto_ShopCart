export const direccionesKeys = {
  todo: ['direcciones'] as const,
  lista: () => [...direccionesKeys.todo, 'lista'] as const,
  departamentos: () => [...direccionesKeys.todo, 'departamentos'] as const,
  municipios: (idDepartamento: number) =>
    [...direccionesKeys.todo, 'municipios', idDepartamento] as const,
};
