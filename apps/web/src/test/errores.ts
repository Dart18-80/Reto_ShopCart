import { ErrorApi } from '../shared/api';

/** Un error del backend ya convertido por el cliente `api` (FE-02), para las pruebas que no pasan por MSW. */
export const errorApiDePrueba = (mensaje: string) =>
  new ErrorApi({
    status: 500,
    codigo: 'ERROR_INTERNO',
    mensaje,
    detalles: undefined,
    requestId: 'req-prueba',
  });
