import { Monto } from '../../../shared/componentes/Monto';
import { TEXTO_NETO_CON_DEVOLUCIONES } from '../graficas';

/**
 * N-11: unas ventas netas negativas (solo hubo devoluciones) llevan su tono y la etiqueta, no solo el signo. El signo
 * se lee del texto del backend; aquí no se calcula nada.
 */
export function MontoNeto({ valor }: { valor: string }) {
  if (!valor.startsWith('-')) return <Monto valor={valor} />;
  return (
    <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1.5">
      <Monto valor={valor} className="text-chart-negativo" />
      <span className="texto-nota text-muted-foreground">
        ({TEXTO_NETO_CON_DEVOLUCIONES.toLowerCase()})
      </span>
    </span>
  );
}
