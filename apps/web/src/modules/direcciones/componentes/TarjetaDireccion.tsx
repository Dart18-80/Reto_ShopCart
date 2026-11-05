import { Aviso } from '../../../shared/componentes/Aviso';
import { Button } from '../../../shared/ui/button';
import type { Direccion } from '../direcciones.api';
import { useActualizarDireccion, useEliminarDireccion } from '../hooks/useOperacionesDeDirecciones';
import { DialogoEditarDireccion } from './DialogoDireccion';

/** Una dirección del Cliente: la predeterminada se marca; las acciones esperan al backend (sin optimismo). */
export function TarjetaDireccion({ direccion }: { direccion: Direccion }) {
  const actualizar = useActualizarDireccion(direccion.idDireccion);
  const eliminar = useEliminarDireccion(direccion.idDireccion);
  const ocupada = actualizar.isPending || eliminar.isPending;
  const titulo = direccion.alias ?? direccion.nombreRecibe;
  const error = actualizar.error ?? eliminar.error;

  return (
    <li className="bg-card flex flex-col gap-3 rounded-lg border p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="texto-base-fuerte">{titulo}</h2>
        {direccion.esPredeterminada && (
          <span className="bg-primary text-primary-foreground texto-nota rounded-full px-2.5 py-0.5">
            Predeterminada
          </span>
        )}
      </div>
      <div className="texto-pequeno text-muted-foreground flex flex-col">
        {direccion.alias && <span>{direccion.nombreRecibe}</span>}
        <span>{direccion.direccionLinea}</span>
        <span>{`${direccion.municipio.nombre}, ${direccion.municipio.departamento.nombre}`}</span>
        {direccion.referencia && <span>{direccion.referencia}</span>}
        <span>{`Tel. ${direccion.telefonoRecibe}`}</span>
      </div>
      {error && <Aviso tipo="error">{error.mensaje}</Aviso>}
      <div className="flex flex-wrap gap-2">
        <DialogoEditarDireccion
          direccion={direccion}
          disparador={
            <Button variant="outline" size="sm" disabled={ocupada} aria-label={`Editar ${titulo}`}>
              Editar
            </Button>
          }
        />
        {!direccion.esPredeterminada && (
          <Button
            variant="outline"
            size="sm"
            disabled={ocupada}
            onClick={() => {
              actualizar.mutate({ esPredeterminada: true });
            }}
          >
            Usar como predeterminada
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={ocupada}
          aria-label={`Eliminar ${titulo}`}
          onClick={() => {
            eliminar.mutate(undefined);
          }}
        >
          Eliminar
        </Button>
      </div>
    </li>
  );
}
