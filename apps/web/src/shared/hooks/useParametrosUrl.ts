import { useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import type { z } from 'zod';

/**
 * Cómo entra un cambio al historial: `agregar` (ordenar, paginar, un filtro de selección), `reemplazar` (una
 * corrección, como la página fuera de rango) o `texto`: la primera edición de un texto libre agrega una entrada y
 * las siguientes la reemplazan, así «atrás» vuelve a la vista anterior a la búsqueda y no a la palabra anterior.
 */
export type ModoHistorial = 'agregar' | 'reemplazar' | 'texto';

export interface ParametrosUrl<T> {
  /** Lo que dice la URL, validado con el esquema: siempre un valor válido. */
  valores: T;
  /** Escribe los cambios en la URL. Todo cambio que no sea de `pagina` vuelve a la página 1. */
  cambiar: (cambios: Partial<T>, opciones?: { historial?: ModoHistorial }) => void;
  /** Hay algún filtro (todo campo salvo página, tamaño, orden y dirección) distinto de su valor por defecto. */
  hayFiltros: boolean;
  limpiarFiltros: () => void;
}

type Crudos = Record<string, string | undefined>;

const CAMPOS_DE_VISTA = new Set(['pagina', 'tamano', 'orden', 'direccion']);
const CAMPO_PAGINA = 'pagina';
// Marca en `history.state` de una entrada creada por una edición de texto libre.
const MARCA_TEXTO = 'shopcartEdicionDeTexto';

const esEdicionDeTexto = (estado: unknown) =>
  typeof estado === 'object' && estado !== null && MARCA_TEXTO in estado;

/**
 * Valida la URL con el esquema. Un campo inválido cae a su valor por defecto sin tirar los demás; si falla una
 * regla del objeto (`.refine`), se descartan los campos que señala.
 */
function leer<S extends z.ZodObject>(esquema: S, busqueda: URLSearchParams): z.output<S> {
  const crudos: Crudos = {};
  for (const campo of Object.keys(esquema.shape)) crudos[campo] = busqueda.get(campo) ?? undefined;
  for (let intento = 0; intento < 2; intento++) {
    const resultado = esquema.safeParse(crudos);
    if (resultado.success) return resultado.data;
    for (const problema of resultado.error.issues) {
      const [campo] = problema.path;
      if (typeof campo === 'string') crudos[campo] = undefined;
    }
  }
  // Las consultas del backend solo tienen campos opcionales o con valor por defecto.
  return esquema.parse({});
}

function aTexto(campo: string, valor: unknown): string {
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  throw new Error(
    `useParametrosUrl no sabe escribir «${campo}» en la URL: solo texto, números y booleanos.`,
  );
}

function escribir(valores: Record<string, unknown>, porDefecto: Record<string, unknown>) {
  const busqueda = new URLSearchParams();
  for (const [campo, valor] of Object.entries(valores)) {
    if (valor === undefined || valor === porDefecto[campo]) continue;
    busqueda.set(campo, aTexto(campo, valor));
  }
  return busqueda;
}

/** FE-06: el estado navegable de una vista vive en la URL, validado con el esquema de *query* del backend. */
export function useParametrosUrl<S extends z.ZodObject>(esquema: S): ParametrosUrl<z.output<S>> {
  const [busqueda, setBusqueda] = useSearchParams();
  const estadoDelHistorial: unknown = useLocation().state;
  const porDefecto = useMemo<Record<string, unknown>>(() => esquema.parse({}), [esquema]);
  const valores = useMemo(() => leer(esquema, busqueda), [esquema, busqueda]);

  function cambiarCrudo(cambios: Record<string, unknown>, historial: ModoHistorial = 'agregar') {
    setBusqueda(
      (previa) => {
        const siguiente: Record<string, unknown> = { ...leer(esquema, previa), ...cambios };
        if (!(CAMPO_PAGINA in cambios)) siguiente[CAMPO_PAGINA] = porDefecto[CAMPO_PAGINA];
        return escribir(siguiente, porDefecto);
      },
      {
        replace:
          historial === 'reemplazar' ||
          (historial === 'texto' && esEdicionDeTexto(estadoDelHistorial)),
        state: historial === 'texto' ? { [MARCA_TEXTO]: true } : null,
      },
    );
  }

  const camposDeFiltro = Object.keys(esquema.shape).filter((campo) => !CAMPOS_DE_VISTA.has(campo));
  const actuales: Record<string, unknown> = valores;

  return {
    valores,
    cambiar: (cambios, opciones) => {
      cambiarCrudo(cambios, opciones?.historial);
    },
    hayFiltros: camposDeFiltro.some((campo) => actuales[campo] !== porDefecto[campo]),
    limpiarFiltros: () => {
      cambiarCrudo(Object.fromEntries(camposDeFiltro.map((campo) => [campo, porDefecto[campo]])));
    },
  };
}
