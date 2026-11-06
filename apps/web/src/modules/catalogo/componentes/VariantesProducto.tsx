import type { ReactNode } from 'react';
import { Aviso } from '../../../shared/componentes/Aviso';
import { Monto } from '../../../shared/componentes/Monto';
import { TablaLocal, type ColumnaTabla } from '../../../shared/componentes/TablaServidor';
import { formatearConteo } from '../../../shared/formato/conteo';
import { Button } from '../../../shared/ui/button';
import type { AccionEstado, Atributo, ProductoAdmin, VarianteAdmin } from '../catalogo.api';
import { useCambiarVariante } from '../hooks/useProductoAdmin';
import { DialogoEditarVariante, DialogoNuevaVariante } from './DialogoVariante';

type Cambiar = (idVariante: number, accion: AccionEstado) => void;

/** RF-03: lo disponible de la existencia física, y lo reservado en pagos en curso; tal como lo cuenta el backend. */
const disponibleDe = (v: VarianteAdmin) =>
  `${String(v.disponible)} de ${String(v.existenciaFisica)}${
    v.reservado > 0 ? ` (${formatearConteo(v.reservado, 'reservada', 'reservadas')})` : ''
  }`;

interface PropsColumnas {
  idProducto: number;
  atributos: Atributo[];
  cambiar: Cambiar;
  ocupada: boolean;
  /** Lo que se agrega a las acciones de cada fila (Cambiar precio, M6-H05). */
  accionesExtra?: (variante: VarianteAdmin) => ReactNode;
}

const columnas = ({
  idProducto,
  atributos,
  cambiar,
  ocupada,
  accionesExtra,
}: PropsColumnas): ColumnaTabla<VarianteAdmin, never>[] => [
  {
    id: 'sku',
    etiqueta: 'SKU',
    prioridad: 1,
    celda: (v) => <span className="texto-pequeno-fuerte">{v.sku}</span>,
  },
  { id: 'atributos', etiqueta: 'Atributos', prioridad: 1, celda: (v) => v.descripcionAtributos },
  {
    id: 'precio',
    etiqueta: 'Precio',
    prioridad: 1,
    alineacion: 'fin',
    celda: (v) => (v.precio === null ? 'Sin precio' : <Monto valor={v.precio} />),
  },
  {
    id: 'disponible',
    etiqueta: 'Disponible',
    prioridad: 1,
    alineacion: 'fin',
    celda: disponibleDe,
  },
  {
    id: 'estado',
    etiqueta: 'Estado',
    prioridad: 1,
    celda: (v) => (
      <span className={v.activo ? 'text-exito' : 'text-muted-foreground'}>
        {v.activo ? 'Activa' : 'Inactiva'}
      </span>
    ),
  },
  {
    id: 'acciones',
    etiqueta: 'Acciones',
    prioridad: 1,
    alineacion: 'fin',
    celda: (v) => (
      <div className="flex flex-wrap justify-end gap-1">
        {accionesExtra?.(v)}
        <DialogoEditarVariante idProducto={idProducto} variante={v} atributos={atributos} />
        <Button
          variant="ghost"
          size="sm"
          disabled={ocupada}
          aria-label={`${v.activo ? 'Desactivar' : 'Activar'} ${v.sku}`}
          onClick={() => {
            cambiar(v.idVariante, v.activo ? 'desactivar' : 'activar');
          }}
        >
          {v.activo ? 'Desactivar' : 'Activar'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={ocupada}
          aria-label={`Eliminar ${v.sku}`}
          onClick={() => {
            cambiar(v.idVariante, 'eliminar');
          }}
        >
          Eliminar
        </Button>
      </div>
    ),
  },
];

interface PropsVariantesProducto {
  producto: ProductoAdmin;
  atributos: Atributo[];
  accionesExtra?: (variante: VarianteAdmin) => ReactNode;
}

/** M6-H04 (Figma 48:1309): las variantes con su precio vigente, su disponible y sus acciones. */
export function VariantesProducto({ producto, atributos, accionesExtra }: PropsVariantesProducto) {
  const cambio = useCambiarVariante(producto.idProducto);
  const cambiar: Cambiar = (idVariante, accion) => {
    cambio.mutate({ idVariante, accion });
  };
  return (
    <section aria-labelledby="titulo-variantes" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-variantes" className="display-titulo-2">
          Variantes
        </h2>
        <DialogoNuevaVariante idProducto={producto.idProducto} atributos={atributos} />
      </div>
      {cambio.error && <Aviso tipo="error">{cambio.error.mensaje}</Aviso>}
      {producto.variantes.length === 0 ? (
        <p className="texto-base text-muted-foreground">
          Todavía no tiene variantes: agrega la primera para venderlo.
        </p>
      ) : (
        <TablaLocal
          titulo="Variantes del producto"
          columnas={columnas({
            idProducto: producto.idProducto,
            atributos,
            cambiar,
            ocupada: cambio.isPending,
            accionesExtra,
          })}
          filas={producto.variantes}
          claveFila={(v) => v.idVariante}
        />
      )}
    </section>
  );
}
