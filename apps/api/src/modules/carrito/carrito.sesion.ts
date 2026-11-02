import { hashearTokenOpaco } from '../../shared/http/index.js';
import { carritoRepository } from './carrito.repository.js';
import type { AjusteFusion } from './carrito.types.js';

/**
 * N-05: al iniciar sesión, el carrito de la cookie se fusiona con el del cliente de la petición (el contexto
 * debe ser el suyo). Devuelve las líneas que no pasaron completas. Un error dentro de la transacción la
 * revierte completa: el carrito de invitado queda intacto.
 */
export function fusionarCarritoDeInvitado(tokenInvitado: string): Promise<AjusteFusion[]> {
  return carritoRepository.fusionar(hashearTokenOpaco(tokenInvitado));
}

/** N-05: al registrarse, el carrito de la cookie pasa a ser del cliente nuevo de la petición. */
export function asignarCarritoDeInvitado(tokenInvitado: string): Promise<void> {
  return carritoRepository.asignarInvitado(hashearTokenOpaco(tokenInvitado));
}
