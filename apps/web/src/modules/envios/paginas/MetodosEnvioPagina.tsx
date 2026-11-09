import { EstadoVista } from '../../../shared/componentes/EstadoVista';
import { Monto } from '../../../shared/componentes/Monto';
import { TablaLocal, type ColumnaTabla } from '../../../shared/componentes/TablaServidor';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { DialogoMetodoEnvio } from '../componentes/DialogoMetodoEnvio';
import { diasDeEntrega } from '../diasDeEntrega';
import type { MetodoEnvioAdmin } from '../envios.api';
import { useMetodosAdmin } from '../hooks/useMetodosAdmin';

const columnas: ColumnaTabla<MetodoEnvioAdmin, never>[] = [
  {
    id: 'nombre',
    etiqueta: 'Método',
    prioridad: 1,
    celda: (m) => (
      <span className="flex flex-col">
        <span className="texto-pequeno-fuerte">{m.nombre}</span>
        <span className="texto-nota text-muted-foreground">{m.codigo}</span>
      </span>
    ),
  },
  {
    id: 'costo',
    etiqueta: 'Costo',
    prioridad: 1,
    alineacion: 'fin',
    celda: (m) => <Monto valor={m.costo} className="texto-pequeno-fuerte" />,
  },
  {
    id: 'dias',
    etiqueta: 'Entrega',
    prioridad: 1,
    celda: (m) => diasDeEntrega(m.diasMin, m.diasMax),
  },
  {
    id: 'estado',
    etiqueta: 'Estado',
    prioridad: 1,
    celda: (m) => (
      <span className={m.activo ? 'text-exito' : 'text-muted-foreground'}>
        {m.activo ? 'Activo' : 'Inactivo'}
      </span>
    ),
  },
  {
    id: 'acciones',
    etiqueta: 'Acciones',
    prioridad: 1,
    alineacion: 'fin',
    celda: (m) => <DialogoMetodoEnvio metodo={m} />,
  },
];

const sinMetodos = (metodos: MetodoEnvioAdmin[]) => metodos.length === 0;

/**
 * M9-H02: `/backoffice/envios`, solo Admin. Todos los métodos, también los inactivos (para reactivarlos), con su
 * tarifa base, sus días y su estado (N-04).
 */
export function MetodosEnvioPagina() {
  useTituloPagina('Envíos');
  const metodos = useMetodosAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="display-titulo-1">Envíos</h1>
        <p className="texto-base text-muted-foreground">
          Los métodos de envío con su tarifa y su plazo de entrega.
        </p>
      </div>
      <EstadoVista
        consulta={metodos}
        esVacio={sinMetodos}
        vacio={{ titulo: 'Sin métodos de envío' }}
      >
        {(lista) => (
          <TablaLocal
            titulo="Métodos de envío"
            columnas={columnas}
            filas={lista}
            claveFila={(m) => m.idMetodoEnvio}
          />
        )}
      </EstadoVista>
    </div>
  );
}
