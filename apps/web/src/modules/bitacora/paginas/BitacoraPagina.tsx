import {
  consultaBitacoraSchema,
  MODULOS_BITACORA,
  type ConsultaBitacora,
  type ModuloBitacora,
} from '@shopcart/shared';
import { useId } from 'react';
import { CLASE_SELECT } from '../../../shared/ui/control';
import { FiltroRangoFechas } from '../../../shared/componentes/FiltroRangoFechas';
import { FiltroTexto } from '../../../shared/componentes/FiltroTexto';
import { TablaServidor, type ColumnaTabla } from '../../../shared/componentes/TablaServidor';
import { formatearConteo } from '../../../shared/formato/conteo';
import { formatearFechaHora } from '../../../shared/formato/fecha';
import { useParametrosUrl, type ParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import type { RegistroBitacora } from '../bitacora.api';
import { cambiosDe } from '../cambios';
import { useBitacora } from '../hooks/useBitacora';
import { EncabezadoPagina } from '../../../shared/componentes/EncabezadoPagina';

// Los módulos como los lee la persona; el código es el de CK_Bitacora_Modulo.
const MODULO: Record<ModuloBitacora, string> = {
  Catalogo: 'Catálogo',
  Inventario: 'Inventario',
  Cupones: 'Cupones',
  Pedidos: 'Pedidos',
  Envios: 'Envíos',
  Usuarios: 'Usuarios',
  Configuracion: 'Configuración',
};

const esModulo = (valor: string): valor is ModuloBitacora =>
  (MODULOS_BITACORA as readonly string[]).includes(valor);

const nombreDelModulo = (modulo: string) => (esModulo(modulo) ? MODULO[modulo] : modulo);

function Filtros({ parametros }: { parametros: ParametrosUrl<ConsultaBitacora> }) {
  const idModulo = useId();
  const { valores, cambiar } = parametros;
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-[12rem_1fr_10rem_10rem]">
      <div className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
        <label htmlFor={idModulo} className="control-etiqueta">
          Módulo
        </label>
        <select
          id={idModulo}
          value={valores.modulo ?? ''}
          onChange={(evento) => {
            const valor = evento.target.value;
            cambiar({ modulo: esModulo(valor) ? valor : undefined });
          }}
          className={CLASE_SELECT}
        >
          <option value="">Todos</option>
          {MODULOS_BITACORA.map((modulo) => (
            <option key={modulo} value={modulo}>
              {MODULO[modulo]}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-2 flex md:col-span-1">
        <FiltroTexto
          parametros={parametros}
          campo="entidad"
          etiqueta="Entidad"
          placeholder="Por ejemplo, Producto"
          maxLength={50}
        />
      </div>
      <FiltroRangoFechas parametros={parametros} />
    </div>
  );
}

/** M10-H02: los cambios de un registro, «antes → después»; la fila se expande con el detalle. */
function Cambios({ registro }: { registro: RegistroBitacora }) {
  const cambios = cambiosDe(registro.valorAnterior, registro.valorNuevo);
  if (cambios.length === 0)
    return <span className="text-muted-foreground">Sin cambios de valores</span>;
  return (
    <details>
      <summary className="text-primary cursor-pointer">
        {formatearConteo(cambios.length, 'cambio', 'cambios')}
      </summary>
      <dl className="texto-nota mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {cambios.map(({ campo, antes, despues }) => (
          <div key={campo} className="contents">
            <dt className="text-muted-foreground">{campo}</dt>
            <dd className="break-all">{`${antes} → ${despues}`}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

const columnas: ColumnaTabla<RegistroBitacora, 'fecha'>[] = [
  {
    id: 'fecha',
    etiqueta: 'Fecha',
    prioridad: 1,
    ordenable: 'fecha',
    celda: (r) => <span className="whitespace-nowrap">{formatearFechaHora(r.fecha)}</span>,
  },
  {
    id: 'usuario',
    etiqueta: 'Usuario',
    prioridad: 2,
    // null: lo hizo un proceso del sistema (un job o el migrador).
    celda: (r) => r.usuario?.nombre ?? 'Sistema',
  },
  { id: 'modulo', etiqueta: 'Módulo', prioridad: 2, celda: (r) => nombreDelModulo(r.modulo) },
  {
    id: 'entidad',
    etiqueta: 'Entidad',
    prioridad: 1,
    celda: (r) => (
      <span className="flex flex-col">
        <span>{r.entidad}</span>
        <span className="texto-nota text-muted-foreground">{`#${r.idEntidad}`}</span>
      </span>
    ),
  },
  { id: 'accion', etiqueta: 'Acción', prioridad: 1, celda: (r) => r.accion },
  { id: 'cambios', etiqueta: 'Cambios', prioridad: 1, celda: (r) => <Cambios registro={r} /> },
];

/**
 * M10-H02: `/backoffice/bitacora`, solo Admin y solo lectura (M-01). Lo que cambió, quién y cuándo, con filtros de
 * módulo, entidad y días de Guatemala, y el orden por fecha del servidor (FE-06).
 */
export function BitacoraPagina() {
  useTituloPagina('Bitácora');
  const parametros = useParametrosUrl(consultaBitacoraSchema);
  const bitacora = useBitacora(parametros.valores);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Bitácora"
        descripcion="Quién cambió qué y cuándo, con el valor anterior y el nuevo."
      />
      <TablaServidor
        titulo="Bitácora"
        columnas={columnas}
        consulta={bitacora}
        parametros={parametros}
        claveFila={(r) => r.idBitacora}
        vacio={{ titulo: 'La bitácora está vacía' }}
        filtros={<Filtros parametros={parametros} />}
      />
    </div>
  );
}
