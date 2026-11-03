import { TriangleAlert } from 'lucide-react';
import type { ErrorApi } from '../api';
import { Aviso } from './Aviso';

const PRIMER_STATUS_DEL_SERVIDOR = 500;

/**
 * El error general de un formulario (FE-03). Un 409 o 422 trae un mensaje específico del backend; un 5xx o una
 * falla de red, el genérico con el `requestId` para reportarlo.
 */
export function AvisoFormulario({ error }: { error: ErrorApi | null }) {
  if (!error) return null;
  const delServidor = error.esDeRed || error.status >= PRIMER_STATUS_DEL_SERVIDOR;
  return (
    <Aviso tipo="error" icono={TriangleAlert}>
      <p>{error.mensaje}</p>
      {delServidor && error.requestId && (
        <p className="texto-nota text-muted-foreground mt-1">
          Código de la solicitud: {error.requestId}
        </p>
      )}
    </Aviso>
  );
}
