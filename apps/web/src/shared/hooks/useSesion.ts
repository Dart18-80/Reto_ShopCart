import { useSyncExternalStore } from 'react';
import { sesion, type Rol } from '../api';

/**
 * Quién está conectado (FE-05, FE-08). La sesión vive fuera de React; el hook solo la observa. Ocultar algo por
 * rol es experiencia de usuario: la autoridad es el backend (RF-01).
 */
export function useSesion() {
  const estado = useSyncExternalStore(sesion.suscribir, sesion.estado);
  const usuario = estado.tipo === 'activa' ? estado.usuario : null;
  return {
    estado,
    usuario,
    rol: usuario?.rol ?? null,
    rehidratando: estado.tipo === 'rehidratando',
    /** El error de la rehidratación por red o 5xx: el guardián lo muestra con Reintentar (F1-H05). */
    errorDeVerificacion: estado.tipo === 'noVerificada' ? estado.error : null,
    tieneRol: (...roles: Rol[]) => usuario !== null && roles.includes(usuario.rol),
    reintentarVerificacion: () => {
      void sesion.rehidratar();
    },
  };
}
