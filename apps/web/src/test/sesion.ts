import {
  sesion,
  type Canal,
  type DatosSesion,
  type MensajeSesion,
  type Rol,
  type Usuario,
} from '../shared/api';

const USUARIOS_DE_PRUEBA = {
  Cliente: { idUsuario: 101, correo: 'cliente@prueba.gt', nombre: 'Ana Cliente', rol: 'Cliente' },
  Operador: {
    idUsuario: 102,
    correo: 'operador@prueba.gt',
    nombre: 'Luis Operador',
    rol: 'Operador',
  },
  Administrador: {
    idUsuario: 103,
    correo: 'admin@prueba.gt',
    nombre: 'Marta Administradora',
    rol: 'Administrador',
  },
} as const satisfies Record<Rol, Usuario>;

export const usuarioDePrueba = (rol: Rol): Usuario => USUARIOS_DE_PRUEBA[rol];

export const sesionDePrueba = (accessToken: string, rol: Rol = 'Cliente'): DatosSesion => ({
  accessToken,
  usuario: usuarioDePrueba(rol),
});

/**
 * Simula `BroadcastChannel` entre pestañas: cada `canal()` es una pestaña; un mensaje llega a las demás, nunca a
 * la que lo publicó, y en una microtarea, como en el navegador, que lo entrega después.
 */
export function crearCanalesEnMemoria() {
  const receptores = new Set<(mensaje: MensajeSesion) => void>();
  return function canal(): Canal {
    let propio: ((mensaje: MensajeSesion) => void) | null = null;
    return {
      publicar(mensaje) {
        for (const receptor of receptores) {
          if (receptor === propio) continue;
          queueMicrotask(() => {
            receptor(mensaje);
          });
        }
      },
      alRecibir(receptor) {
        propio = receptor;
        receptores.add(receptor);
      },
    };
  };
}

/** El estado de la sesión de la aplicación, para las pruebas de páginas (que no pueden importar shared/api). */
export const estadoDeLaSesion = () => sesion.estado();
