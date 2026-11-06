import { EstadoVista } from '../../../shared/componentes/EstadoVista';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../../../shared/ui/dialog';
import { useExistenciaDeVariante } from '../hooks/useExistencias';
import type { Existencia } from '../inventario.api';
import { FormularioAjuste } from './FormularioAjuste';
import { KardexVariante } from './KardexVariante';

/** Lo que el Operador abre desde una fila: ajustar la existencia (con el kardex debajo) o solo el kardex. */
export type ModoVariante = 'ajustar' | 'kardex';

export interface VarianteElegida {
  idVariante: number;
  sku: string;
  modo: ModoVariante;
}

const TITULO: Record<ModoVariante, (sku: string) => string> = {
  ajustar: (sku) => `Ajustar ${sku}`,
  kardex: (sku) => `Kardex de ${sku}`,
};

const SIN_VARIANTE = { titulo: 'Esta variante ya no existe' };
const esNula = (existencia: Existencia | null) => existencia === null;

function ResumenExistencia({ existencia }: { existencia: Existencia }) {
  const cifras = [
    ['Física', existencia.existenciaFisica],
    ['Reservado', existencia.reservado],
    ['Disponible', existencia.disponible],
  ] as const;
  return (
    <ul aria-label="Existencia" className="flex gap-6">
      {cifras.map(([etiqueta, valor]) => (
        <li key={etiqueta} className="flex flex-col">
          <span className="texto-nota text-muted-foreground">{etiqueta}</span>
          <span className="display-titulo-3 tabular-nums">{String(valor)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * M7-H02 (Figma 48:1617): la existencia de la variante, pedida por su ID (la fila puede cambiar de lugar al
 * ajustar), el ajuste y el kardex. Al registrar, todo se vuelve a pedir al backend.
 */
export function DialogoVarianteInventario({
  variante,
  alCerrar,
}: {
  variante: VarianteElegida;
  alCerrar: () => void;
}) {
  const existencia = useExistenciaDeVariante(variante.idVariante);
  return (
    <Dialog
      open
      onOpenChange={(abierto) => {
        if (!abierto) alCerrar();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogTitle className="display-titulo-3">
          {TITULO[variante.modo](variante.sku)}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Existencia física, reservada y disponible de la variante, y sus movimientos en el kardex.
        </DialogDescription>
        <EstadoVista consulta={existencia} vacio={SIN_VARIANTE} esVacio={esNula}>
          {(datos) =>
            datos && (
              <div className="flex flex-col gap-5">
                <ResumenExistencia existencia={datos} />
                {variante.modo === 'ajustar' && <FormularioAjuste existencia={datos} />}
              </div>
            )
          }
        </EstadoVista>
        <hr className="border-border" />
        <KardexVariante idVariante={variante.idVariante} />
      </DialogContent>
    </Dialog>
  );
}
