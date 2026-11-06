import { consultaExistenciasSchema, type OrdenExistencias } from '@shopcart/shared';
import { useMemo, useState } from 'react';
import { TablaServidor, type ColumnaTabla } from '../../../shared/componentes/TablaServidor';
import { useParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { Button } from '../../../shared/ui/button';
import { cn } from '../../../shared/ui/cn';
import { AvisoConciliacion } from '../componentes/AvisoConciliacion';
import { DialogoRegistrarEntrada } from '../componentes/DialogoRegistrarEntrada';
import {
  DialogoVarianteInventario,
  type ModoVariante,
  type VarianteElegida,
} from '../componentes/DialogoVarianteInventario';
import { FiltrosExistencias } from '../componentes/FiltrosExistencias';
import { useExistencias } from '../hooks/useExistencias';
import type { Existencia } from '../inventario.api';
import { nombreDeVariante } from '../nombreDeVariante';

const cantidad = (valor: number) => <span className="tabular-nums">{String(valor)}</span>;

type Columna = ColumnaTabla<Existencia, OrdenExistencias['orden']>;

const ACCIONES: { modo: ModoVariante; etiqueta: string; nombre: (sku: string) => string }[] = [
  { modo: 'ajustar', etiqueta: 'Ajustar', nombre: (sku) => `Ajustar ${sku}` },
  { modo: 'kardex', etiqueta: 'Ver kardex', nombre: (sku) => `Ver kardex de ${sku}` },
];

const columnaAcciones = (elegir: (variante: VarianteElegida) => void): Columna => ({
  id: 'acciones',
  etiqueta: 'Acciones',
  prioridad: 1,
  alineacion: 'fin',
  celda: (e) => (
    <span className="inline-flex gap-1">
      {ACCIONES.map(({ modo, etiqueta, nombre }) => (
        <Button
          key={modo}
          variant="link"
          size="sm"
          aria-label={nombre(e.sku)}
          onClick={() => {
            elegir({ idVariante: e.idVariante, sku: e.sku, modo });
          }}
        >
          {etiqueta}
        </Button>
      ))}
    </span>
  ),
});

const columnas: Columna[] = [
  {
    id: 'sku',
    etiqueta: 'SKU',
    prioridad: 1,
    ordenable: 'sku',
    celda: (e) => <span className="texto-pequeno-fuerte">{e.sku}</span>,
  },
  {
    id: 'producto',
    etiqueta: 'Producto',
    prioridad: 1,
    ordenable: 'producto',
    celda: nombreDeVariante,
  },
  {
    id: 'fisica',
    etiqueta: 'Física',
    prioridad: 2,
    alineacion: 'fin',
    celda: (e) => cantidad(e.existenciaFisica),
  },
  {
    id: 'reservado',
    etiqueta: 'Reservado',
    prioridad: 2,
    alineacion: 'fin',
    celda: (e) => cantidad(e.reservado),
  },
  {
    id: 'disponible',
    etiqueta: 'Disponible',
    prioridad: 1,
    alineacion: 'fin',
    ordenable: 'disponible',
    // El disponible lo calcula FU_Inventario_Disponible; la página solo marca el agotado.
    celda: (e) => (
      <span
        className={cn('texto-pequeno-fuerte tabular-nums', e.disponible === 0 && 'text-oferta')}
      >
        {String(e.disponible)}
      </span>
    ),
  },
];

/**
 * M7-H01 (Figma 48:1488): `/backoffice/inventario`, las existencias por variante con búsqueda, orden y
 * paginación del servidor (FE-06) y, arriba, la conciliación con el kardex (N-07). M7-H02: entradas, ajustes y el
 * kardex de cada variante. Operador y Administrador.
 */
export function InventarioPagina() {
  useTituloPagina('Inventario');
  const parametros = useParametrosUrl(consultaExistenciasSchema);
  const existencias = useExistencias(parametros.valores);
  // El diálogo vive en la página y no en la fila: un ajuste puede mover la fila de lugar o de página.
  const [elegida, setElegida] = useState<VarianteElegida | null>(null);
  const columnasConAcciones = useMemo(() => [...columnas, columnaAcciones(setElegida)], []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="display-titulo-1">Inventario</h1>
          <p className="texto-base text-muted-foreground">
            Existencias por variante, entradas, ajustes y kardex.
          </p>
        </div>
        <DialogoRegistrarEntrada />
      </div>
      <AvisoConciliacion />
      <TablaServidor
        titulo="Existencias"
        columnas={columnasConAcciones}
        consulta={existencias}
        parametros={parametros}
        claveFila={(e) => e.idVariante}
        vacio={{
          titulo: 'Sin variantes que coincidan',
          descripcion: 'Prueba con otro SKU o nombre de producto.',
        }}
        filtros={<FiltrosExistencias parametros={parametros} />}
      />
      {elegida && (
        <DialogoVarianteInventario
          variante={elegida}
          alCerrar={() => {
            setElegida(null);
          }}
        />
      )}
    </div>
  );
}
