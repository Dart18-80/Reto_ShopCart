/** Puerto: la hora actual. Las reglas que dependen de la fecha se prueban sin depender del reloj real. */
export interface Reloj {
  ahora(): Date;
}

export const relojDelSistema: Reloj = { ahora: () => new Date() };
