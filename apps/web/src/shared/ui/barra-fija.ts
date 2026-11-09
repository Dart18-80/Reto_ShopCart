/*
 * D4: la barra de acción fija abajo en móvil (detalle, carrito y pago): respeta el área segura del teléfono
 * (`env(safe-area-inset-bottom)`) y desde md vuelve a su lugar en la página. La página que la usa reserva su alto
 * abajo con RESERVA_*, así lo último del contenido nunca queda debajo de la barra.
 */
export const CLASE_BARRA_FIJA =
  'bg-card fixed inset-x-0 bottom-0 z-10 border-t px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:static md:z-auto md:border-0 md:bg-transparent md:p-0';

/** Para una barra de un botón (76 px): 96 px más el área segura. */
export const RESERVA_BARRA_BOTON = 'pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0';

/** Para una barra con el total y el botón (114 px): 144 px más el área segura. */
export const RESERVA_BARRA_TOTAL = 'pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-0';
