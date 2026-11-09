import { EstadoVista } from '../../../shared/componentes/EstadoVista';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { Button } from '../../../shared/ui/button';
import { DialogoNuevaDireccion } from '../componentes/DialogoDireccion';
import { TarjetaDireccion } from '../componentes/TarjetaDireccion';
import type { Direccion } from '../direcciones.api';
import { useDirecciones } from '../hooks/useDirecciones';

const sinDirecciones = (direcciones: Direccion[]) => direcciones.length === 0;
const BOTON_NUEVA = <Button className="px-5">Agregar dirección</Button>;

/** M4-H01: `/cuenta/direcciones`, las direcciones de entrega del Cliente (RF-01: solo las suyas). */
export function DireccionesPagina() {
  useTituloPagina('Mis direcciones');
  const direcciones = useDirecciones();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="titulo-1">Mis direcciones</h1>
        <DialogoNuevaDireccion disparador={BOTON_NUEVA} />
      </div>
      <EstadoVista
        consulta={direcciones}
        esVacio={sinDirecciones}
        vacio={{
          titulo: 'Todavía no tienes direcciones',
          descripcion: 'Agrega una para recibir tus pedidos.',
        }}
      >
        {(lista) => (
          <ul aria-label="Direcciones" className="grid gap-4 md:grid-cols-2">
            {lista.map((direccion) => (
              <TarjetaDireccion key={direccion.idDireccion} direccion={direccion} />
            ))}
          </ul>
        )}
      </EstadoVista>
    </>
  );
}
