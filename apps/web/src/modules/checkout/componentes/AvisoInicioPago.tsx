import { Link } from 'react-router';
import type { ErrorApi } from '../../../shared/api';
import { Aviso } from '../../../shared/componentes/Aviso';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { Button } from '../../../shared/ui/button';
import { lineasSinExistencia } from '../existenciaInsuficiente';
import { RUTAS } from '../../../shared/rutas';

/**
 * M4-H02: por qué no se pudo iniciar el pago. Sin existencia suficiente (N-06, todo o nada) lista cada línea con
 * su disponible y ofrece volver al carrito para ajustarla; los demás rechazos, con el mensaje del backend.
 */
export function AvisoInicioPago({ error }: { error: ErrorApi | null }) {
  if (!error) return null;
  const lineas = lineasSinExistencia(error);
  if (!lineas) return <AvisoFormulario error={error} />;
  return (
    <Aviso tipo="error">
      <p>{error.mensaje}</p>
      <ul className="mt-1 list-disc pl-5">
        {lineas.map((linea) => (
          <li key={linea.idVariante}>
            {`${linea.producto}: pediste ${String(linea.cantidad)}, quedan ${String(linea.disponible)}.`}
          </li>
        ))}
      </ul>
      <Button asChild variant="outline" size="sm" className="mt-3">
        <Link to={RUTAS.carrito}>Volver al carrito</Link>
      </Button>
    </Aviso>
  );
}
