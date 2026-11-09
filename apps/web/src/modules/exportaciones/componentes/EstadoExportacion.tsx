import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { Button } from '../../../shared/ui/button';
import type { Exportacion } from '../exportaciones.api';
import { useDescargarExportacion } from '../hooks/useExportaciones';

const TEXTO_DEL_ESTADO: Record<Exportacion['estado'], string> = {
  Pendiente: 'En cola',
  Procesando: 'Generando el archivo…',
  Completada: 'Lista para descargar',
  Fallida: 'No se pudo generar',
  Expirada: 'El archivo venció; pídela de nuevo',
};

/** El estado de una exportación con texto; si falló, el mensaje del backend. */
export function TextoEstadoExportacion({ exportacion }: { exportacion: Exportacion }) {
  return (
    <span className="flex flex-col">
      <span className={exportacion.estado === 'Fallida' ? 'text-destructive' : undefined}>
        {TEXTO_DEL_ESTADO[exportacion.estado]}
      </span>
      {exportacion.error && (
        <span className="texto-nota text-muted-foreground">{exportacion.error}</span>
      )}
    </span>
  );
}

/**
 * «Descargar» solo cuando el backend da el enlace del archivo (`archivo`, es decir, Completada). Un 409 o un 410 se
 * muestran con el mensaje del backend.
 */
export function DescargarExportacion({ exportacion }: { exportacion: Exportacion }) {
  const descarga = useDescargarExportacion();
  if (exportacion.archivo === null) return null;
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={descarga.isPending}
        onClick={() => {
          descarga.mutate(exportacion);
        }}
      >
        Descargar
      </Button>
      <AvisoFormulario error={descarga.error} />
    </span>
  );
}
