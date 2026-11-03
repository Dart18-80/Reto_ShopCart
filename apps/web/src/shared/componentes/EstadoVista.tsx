import type { UseQueryResult } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ErrorApi } from '../api';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Aviso } from './Aviso';

export interface ContenidoVacio {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}

interface PropsEstadoVista<D> {
  consulta: UseQueryResult<D>;
  vacio: ContenidoVacio;
  /** Por defecto, la respuesta está vacía si su arreglo `datos` no tiene elementos. */
  esVacio?: (datos: D) => boolean;
  /** Lo que se ve mientras carga por primera vez; por defecto, tres líneas de esqueleto. */
  esqueleto?: ReactNode;
  children: (datos: D) => ReactNode;
}

const sinDatos = (respuesta: unknown) =>
  typeof respuesta === 'object' &&
  respuesta !== null &&
  'datos' in respuesta &&
  Array.isArray(respuesta.datos) &&
  respuesta.datos.length === 0;

const ESQUELETO = (
  <div className="flex flex-col gap-3">
    <Skeleton className="h-6 w-1/3" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-2/3" />
  </div>
);

function AvisoDeError({ error, onReintentar }: { error: ErrorApi; onReintentar: () => void }) {
  return (
    <Aviso
      tipo="error"
      icono={TriangleAlert}
      acciones={
        <Button variant="outline" size="sm" onClick={onReintentar}>
          Reintentar
        </Button>
      }
    >
      <p>{error.mensaje}</p>
      {error.requestId && (
        <p className="texto-nota text-muted-foreground mt-1">
          Código de la solicitud: {error.requestId}
        </p>
      )}
    </Aviso>
  );
}

export function Vacio({ titulo, descripcion, accion }: ContenidoVacio) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <p className="texto-base-fuerte">{titulo}</p>
      {descripcion && <p className="texto-pequeno text-muted-foreground">{descripcion}</p>}
      {accion}
    </div>
  );
}

/**
 * Toda consulta se muestra a través de aquí (enunciado: carga, vacío y error en todas las vistas): esqueleto al
 * cargar, vacío con un mensaje útil y error con el mensaje del backend, Reintentar y el requestId.
 */
export function EstadoVista<D>({
  consulta,
  vacio,
  esVacio = sinDatos,
  esqueleto = ESQUELETO,
  children,
}: PropsEstadoVista<D>) {
  const reintentar = () => {
    void consulta.refetch();
  };

  if (consulta.isPending) {
    return (
      <div role="status">
        <span className="sr-only">Cargando…</span>
        {esqueleto}
      </div>
    );
  }
  if (consulta.isLoadingError) {
    return <AvisoDeError error={consulta.error} onReintentar={reintentar} />;
  }
  // Con datos: un éxito o una recarga que falló, que deja los datos anteriores con el aviso arriba.
  return (
    <>
      {consulta.isRefetchError && <AvisoDeError error={consulta.error} onReintentar={reintentar} />}
      {esVacio(consulta.data) ? <Vacio {...vacio} /> : children(consulta.data)}
    </>
  );
}
