import {
  consultaCuponesSchema,
  montoMenorOIgual,
  type ConsultaCupones,
  type OrdenCupones,
} from '@shopcart/shared';
import { useId } from 'react';
import { Aviso } from '../../../shared/componentes/Aviso';
import { CLASE_SELECT } from '../../../shared/ui/control';
import { Monto } from '../../../shared/componentes/Monto';
import { TablaServidor, type ColumnaTabla } from '../../../shared/componentes/TablaServidor';
import { formatearDia } from '../../../shared/formato/fecha';
import { formatearMonto, formatearPorcentaje } from '../../../shared/formato/monto';
import { useParametrosUrl, type ParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { Button } from '../../../shared/ui/button';
import { DialogoEditarCupon, DialogoNuevoCupon } from '../componentes/DialogoCupon';
import type { AccionCupon, Cupon } from '../cupones.api';
import { useCambiarEstadoCupon, useCupones } from '../hooks/useCupones';
import { EncabezadoPagina } from '../../../shared/componentes/EncabezadoPagina';

const SIN_MINIMO = '0';

const ESTADOS = { '': 'Activos e inactivos', true: 'Activos', false: 'Inactivos' } as const;
const estadoDe = (activo: boolean | undefined) =>
  activo === undefined ? '' : activo ? 'true' : 'false';

function FiltroEstado({ parametros }: { parametros: ParametrosUrl<ConsultaCupones> }) {
  const id = useId();
  const { valores, cambiar } = parametros;
  return (
    <div className="flex max-w-xs flex-col gap-1.5">
      <label htmlFor={id} className="control-etiqueta">
        Estado
      </label>
      <select
        id={id}
        value={estadoDe(valores.activo)}
        onChange={(evento) => {
          const valor = evento.target.value;
          cambiar({ activo: valor === '' ? undefined : valor === 'true' });
        }}
        className={CLASE_SELECT}
      >
        {Object.entries(ESTADOS).map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Los valores tal como llegan (FE-10): un porcentaje con su tope o un monto fijo, y la compra mínima si hay. */
function Descuento({ cupon }: { cupon: Cupon }) {
  return (
    <span className="flex flex-col">
      <span className="texto-pequeno-fuerte">
        {cupon.tipo === 'Porcentaje' ? (
          `${formatearPorcentaje(cupon.valor)}${
            cupon.montoMaximoDescuento === null
              ? ''
              : ` hasta ${formatearMonto(cupon.montoMaximoDescuento)}`
          }`
        ) : (
          <Monto valor={cupon.valor} />
        )}
      </span>
      {!montoMenorOIgual(cupon.montoMinimoCompra, SIN_MINIMO) && (
        <span className="texto-nota text-muted-foreground">
          {`Compra mínima ${formatearMonto(cupon.montoMinimoCompra)}`}
        </span>
      )}
    </span>
  );
}

type Columna = ColumnaTabla<Cupon, OrdenCupones['orden']>;

const columnas = (
  cambiar: (idCupon: number, accion: AccionCupon) => void,
  ocupado: boolean,
): Columna[] => [
  {
    id: 'codigo',
    etiqueta: 'Código',
    prioridad: 1,
    ordenable: 'codigo',
    celda: (c) => (
      <span className="flex flex-col">
        <span className="texto-pequeno-fuerte">{c.codigo}</span>
        <span className="texto-nota text-muted-foreground">{c.descripcion}</span>
      </span>
    ),
  },
  { id: 'descuento', etiqueta: 'Descuento', prioridad: 1, celda: (c) => <Descuento cupon={c} /> },
  {
    id: 'alcance',
    etiqueta: 'Alcance',
    prioridad: 2,
    celda: (c) => c.categoria?.nombre ?? 'Toda la tienda',
  },
  {
    id: 'vigencia',
    etiqueta: 'Vigencia',
    prioridad: 2,
    ordenable: 'vigencia',
    celda: (c) => (
      <span className="whitespace-nowrap">{`${formatearDia(c.fechaInicio)} – ${formatearDia(c.fechaFin)}`}</span>
    ),
  },
  {
    id: 'usos',
    etiqueta: 'Usos',
    prioridad: 1,
    ordenable: 'usos',
    alineacion: 'fin',
    // N-12: los comprometidos (reservados en un pago en curso y confirmados) de su límite total.
    celda: (c) => (
      <span className="flex flex-col items-end">
        <span className="tabular-nums whitespace-nowrap">{`${String(c.usosComprometidos)} de ${String(c.limiteUsosTotal)}`}</span>
        <span className="texto-nota text-muted-foreground whitespace-nowrap">{`${String(c.limiteUsosPorCliente)} por cliente`}</span>
      </span>
    ),
  },
  {
    id: 'estado',
    etiqueta: 'Estado',
    prioridad: 1,
    // El estado y lo que lo cambia, juntos: la tabla cabe a 1280 px con la barra lateral.
    celda: (c) => (
      <span className="flex flex-col items-start">
        <span className={c.activo ? 'text-exito' : 'text-muted-foreground'}>
          {c.activo ? 'Activo' : 'Inactivo'}
        </span>
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          disabled={ocupado}
          aria-label={`${c.activo ? 'Desactivar' : 'Activar'} ${c.codigo}`}
          onClick={() => {
            cambiar(c.idCupon, c.activo ? 'desactivar' : 'activar');
          }}
        >
          {c.activo ? 'Desactivar' : 'Activar'}
        </Button>
      </span>
    ),
  },
  {
    id: 'acciones',
    etiqueta: 'Acciones',
    prioridad: 1,
    alineacion: 'fin',
    celda: (c) => <DialogoEditarCupon cupon={c} />,
  },
];

/**
 * M9-H01: `/backoffice/cupones`, solo Admin. Los cupones con su descuento, alcance, vigencia y usos, con orden,
 * filtro y paginación del servidor (FE-06, M6-H01); alta, edición, activar y desactivar.
 */
export function CuponesPagina() {
  useTituloPagina('Cupones');
  const parametros = useParametrosUrl(consultaCuponesSchema);
  const cupones = useCupones(parametros.valores);
  const estado = useCambiarEstadoCupon();

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Cupones"
        descripcion="Descuentos por código para toda la tienda o una categoría."
        acciones={<DialogoNuevoCupon />}
      />
      {estado.error && <Aviso tipo="error">{estado.error.mensaje}</Aviso>}
      <TablaServidor
        titulo="Cupones"
        columnas={columnas((idCupon, accion) => {
          estado.mutate({ idCupon, accion });
        }, estado.isPending)}
        consulta={cupones}
        parametros={parametros}
        claveFila={(c) => c.idCupon}
        vacio={{ titulo: 'Todavía no hay cupones', descripcion: 'Crea el primero.' }}
        filtros={<FiltroEstado parametros={parametros} />}
      />
    </div>
  );
}
