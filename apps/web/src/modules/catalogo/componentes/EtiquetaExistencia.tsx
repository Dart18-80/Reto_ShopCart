import { cn } from '../../../shared/ui/cn';
import type { EstadoExistencia } from '../catalogo.api';

const ESTILO: Record<EstadoExistencia, { texto: string; punto: string }> = {
  Disponible: { texto: 'text-exito', punto: 'bg-exito' },
  UltimasUnidades: { texto: 'text-aviso', punto: 'bg-aviso' },
  Agotado: { texto: 'text-muted-foreground', punto: 'bg-muted-foreground' },
};

interface PropsEtiquetaExistencia {
  estado: EstadoExistencia;
  /** N-06: solo con UltimasUnidades llega la cifra; en los demás estados nunca se muestra. */
  unidadesRestantes?: number;
}

const textoDe = (estado: EstadoExistencia, unidadesRestantes: number | undefined) => {
  if (estado === 'Disponible') return 'Disponible';
  if (estado === 'Agotado') return 'Agotado';
  return unidadesRestantes === 1
    ? 'Última unidad'
    : `Últimas ${String(unidadesRestantes ?? '')} unidades`;
};

/** Figma: Existencia (5:54). El estado siempre con texto, nunca solo con el color del punto. */
export function EtiquetaExistencia({ estado, unidadesRestantes }: PropsEtiquetaExistencia) {
  const { texto, punto } = ESTILO[estado];
  return (
    <p className={cn('texto-pequeno-fuerte flex items-center gap-1.5', texto)}>
      <span aria-hidden className={cn('size-2 rounded-full', punto)} />
      {textoDe(estado, unidadesRestantes)}
    </p>
  );
}
