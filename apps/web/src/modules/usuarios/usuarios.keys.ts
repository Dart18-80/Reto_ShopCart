import type { ConsultaUsuarios } from '@shopcart/shared';

export const usuariosKeys = {
  todo: ['usuarios'] as const,
  perfil: () => [...usuariosKeys.todo, 'perfil'] as const,
  listas: () => [...usuariosKeys.todo, 'lista'] as const,
  lista: (consulta: ConsultaUsuarios) => [...usuariosKeys.listas(), consulta] as const,
};
