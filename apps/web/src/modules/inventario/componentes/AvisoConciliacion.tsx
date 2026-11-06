import { TriangleAlert } from 'lucide-react';
import { Aviso } from '../../../shared/componentes/Aviso';
import { Button } from '../../../shared/ui/button';
import { useConciliacion } from '../hooks/useExistencias';
import type { Descuadre } from '../inventario.api';

const COINCIDE = 'La existencia coincide con el kardex en todas las variantes.';

const resumenDe = (descuadres: Descuadre[]) =>
  descuadres.length === 1
    ? '1 variante no coincide con su kardex:'
    : `${String(descuadres.length)} variantes no coinciden con su kardex:`;

/**
 * M7-H01 (Figma 48:1488): el resultado de `GET /inventario/conciliacion` (N-07). Los números son los que
 * calcula la vista de la base; la página no compara nada.
 */
export function AvisoConciliacion() {
  const conciliacion = useConciliacion();

  if (conciliacion.isPending) return null;
  if (conciliacion.isError) {
    return (
      <Aviso
        tipo="error"
        icono={TriangleAlert}
        acciones={
          <Button variant="outline" size="sm" onClick={() => void conciliacion.refetch()}>
            Reintentar
          </Button>
        }
      >
        No pudimos revisar la conciliación del kardex.
      </Aviso>
    );
  }
  const descuadres = conciliacion.data;
  if (descuadres.length === 0) return <Aviso tipo="exito">{COINCIDE}</Aviso>;

  return (
    <Aviso tipo="error" icono={TriangleAlert}>
      <p className="texto-pequeno-fuerte">{resumenDe(descuadres)}</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {descuadres.map((d) => (
          <li key={d.idVariante} className="tabular-nums">
            {`${d.sku}: física ${String(d.existenciaFisica)}, kardex ${String(d.sumaKardex)}`}
          </li>
        ))}
      </ul>
    </Aviso>
  );
}
