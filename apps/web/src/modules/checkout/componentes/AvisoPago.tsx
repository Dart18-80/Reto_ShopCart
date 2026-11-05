import type { ErrorApi } from '../../../shared/api';
import { Aviso } from '../../../shared/componentes/Aviso';
import { Button } from '../../../shared/ui/button';
import type { Desenlace } from '../politicaDePago';

interface PropsAvisoPago {
  error: ErrorApi;
  desenlace: Desenlace;
  alReintentar: () => void;
  reintentando: boolean;
}

const STATUS_VALIDACION = 400;
const PAGO_EN_CURSO = 'Estamos procesando tu pago. Espera un momento y reintenta.';

/** M4-H03: el aviso de cada respuesta del pago, según la tabla de la llave (politicaDePago). */
export function AvisoPago({ error, desenlace, alReintentar, reintentando }: PropsAvisoPago) {
  switch (desenlace.tipo) {
    case 'reintentar':
      return (
        <Aviso
          tipo="advertencia"
          acciones={
            <Button variant="outline" size="sm" disabled={reintentando} onClick={alReintentar}>
              Reintentar
            </Button>
          }
        >
          {error.codigo === 'PAGO_EN_CURSO' ? PAGO_EN_CURSO : error.mensaje}
        </Aviso>
      );
    case 'corregir':
      // Un 400 ya marcó sus campos en el formulario (FE-03): no se repite arriba.
      return error.status === STATUS_VALIDACION ? null : (
        <Aviso tipo="error">{error.mensaje}</Aviso>
      );
    case 'inesperado':
      return (
        <Aviso tipo="error">
          <p>{error.mensaje}</p>
          {error.requestId && (
            <p className="texto-nota text-muted-foreground mt-1">
              Código de la solicitud: {error.requestId}
            </p>
          )}
        </Aviso>
      );
    // La página sale del pago y avisa con un toast.
    case 'volverAlCheckout':
    case 'volverAlCarrito':
      return null;
  }
}
