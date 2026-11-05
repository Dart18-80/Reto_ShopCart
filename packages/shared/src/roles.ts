/**
 * Los roles de una cuenta de usuario (S001). 'Sistema' es el rol de los jobs y del migrador (A-18): ningún token
 * lo trae. La API lo usa en el token y en sus esquemas; la web, para validar los mensajes entre pestañas.
 */
export const ROLES_DE_USUARIO = ['Cliente', 'Operador', 'Administrador'] as const;

export type RolDeUsuario = (typeof ROLES_DE_USUARIO)[number];
