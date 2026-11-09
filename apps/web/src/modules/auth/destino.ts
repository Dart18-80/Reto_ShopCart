import type { Rol } from '../../shared/api';
import { RUTAS } from '../../shared/rutas';

const DESTINO_DEL_CLIENTE = '/';
const DESTINO_DEL_PERSONAL = RUTAS.backoffice;
// Volver a una de estas con sesión ya abierta solo devolvería al mismo formulario.
const RUTAS_DE_ACCESO: readonly string[] = [RUTAS.ingresar, RUTAS.registro];
// Una ruta interna: empieza con una sola barra y sigue con algo que no es otra barra ni una barra invertida
// (`//sitio` y `/\sitio` son URLs de otro sitio para el navegador). Sin espacios ni caracteres de control.
const PATRON_RUTA_INTERNA = /^\/(?![/\\])[^\s\\]*$/;

const destinoPorDefecto = (rol: Rol) =>
  rol === 'Cliente' ? DESTINO_DEL_CLIENTE : DESTINO_DEL_PERSONAL;

/**
 * M1-H01: a dónde va quien acaba de ingresar. `volver` llega en la URL (`/ingresar?volver=…`): solo se acepta una
 * ruta interna; cualquier otra cosa lleva al destino por defecto, así el enlace no sirve para mandar a otro sitio.
 */
export function destinoAlIngresar(volver: string | null, rol: Rol): string {
  if (volver === null || !PATRON_RUTA_INTERNA.test(volver)) return destinoPorDefecto(rol);
  const ruta = volver.split(/[?#]/)[0] ?? '';
  if (RUTAS_DE_ACCESO.includes(ruta)) return destinoPorDefecto(rol);
  return volver;
}
