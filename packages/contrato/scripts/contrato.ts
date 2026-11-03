// FE-13: funciones puras de la foto del contrato y de su matriz de cobertura. Sin E/S: las usan exportar.ts,
// verificar.ts y cobertura.ts, y se prueban sin levantar nada.

const METODOS_HTTP = ['get', 'post', 'put', 'patch', 'delete'] as const;

/** Lo único que estos scripts leen del documento OpenAPI. */
export interface DocumentoOpenApi {
  paths?: Record<string, Partial<Record<string, { tags?: string[] }>>>;
}

export interface Operacion {
  metodo: string;
  ruta: string;
  modulo: string;
}

export interface RutaUsada {
  metodo: string;
  ruta: string;
}

export interface Exclusion extends RutaUsada {
  motivo: string;
}

export type EstadoRuta =
  | { metodo: string; ruta: string; estado: 'cubierta' | 'pendiente' }
  | { metodo: string; ruta: string; estado: 'excluida'; motivo: string };

export interface Cobertura {
  modulos: Map<string, EstadoRuta[]>;
  cubiertas: number;
  excluidas: number;
  pendientes: number;
  inconsistencias: string[];
}

const SIN_MODULO = '(sin etiqueta)';

function ordenarClaves(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenarClaves);
  if (typeof valor !== 'object' || valor === null) return valor;
  return Object.fromEntries(
    Object.keys(valor)
      .sort()
      .map((clave) => [clave, ordenarClaves((valor as Record<string, unknown>)[clave])]),
  );
}

/** Claves ordenadas y sangría fija: el diff de la foto solo muestra cambios reales del contrato. */
export function serializarFoto(documento: unknown): string {
  return `${JSON.stringify(ordenarClaves(documento), null, 2)}\n`;
}

/** Los archivos de la foto cuyo contenido guardado no coincide con el que genera el código. */
export function diferenciasDeFoto(
  generados: Record<string, string>,
  guardados: Record<string, string | undefined>,
): string[] {
  return Object.keys(generados).filter((archivo) => guardados[archivo] !== generados[archivo]);
}

export function operacionesDelDocumento(documento: DocumentoOpenApi): Operacion[] {
  return Object.entries(documento.paths ?? {}).flatMap(([ruta, operaciones]) =>
    METODOS_HTTP.flatMap((metodo) => {
      const operacion = operaciones[metodo];
      if (!operacion) return [];
      return [{ metodo: metodo.toUpperCase(), ruta, modulo: operacion.tags?.[0] ?? SIN_MODULO }];
    }),
  );
}

// FE-13: cada llamada escribe su ruta como texto literal, `api.GET('/api/v1/pedidos/{id}', …)`.
const LLAMADA_API = /\bapi\.(GET|POST|PUT|PATCH|DELETE)\(\s*['"`]([^'"`]+)['"`]/g;

export function rutasUsadas(fuente: string): RutaUsada[] {
  return [...fuente.matchAll(LLAMADA_API)].map(([, metodo = '', ruta = '']) => ({ metodo, ruta }));
}

const llave = ({ metodo, ruta }: RutaUsada) => `${metodo} ${ruta}`;

function estadoDe(
  operacion: Operacion,
  usadas: Set<string>,
  exclusiones: Map<string, Exclusion>,
): EstadoRuta {
  const { metodo, ruta } = operacion;
  const exclusion = exclusiones.get(llave(operacion));
  if (exclusion) return { metodo, ruta, estado: 'excluida', motivo: exclusion.motivo };
  return { metodo, ruta, estado: usadas.has(llave(operacion)) ? 'cubierta' : 'pendiente' };
}

export function calcularCobertura(
  operaciones: Operacion[],
  usadas: RutaUsada[],
  exclusiones: Exclusion[],
): Cobertura {
  const llavesUsadas = new Set(usadas.map(llave));
  const porLlave = new Map(exclusiones.map((exclusion) => [llave(exclusion), exclusion]));
  const existentes = new Set(operaciones.map(llave));

  const modulos = new Map<string, EstadoRuta[]>();
  for (const operacion of operaciones) {
    const estados = modulos.get(operacion.modulo) ?? [];
    estados.push(estadoDe(operacion, llavesUsadas, porLlave));
    modulos.set(operacion.modulo, estados);
  }

  const todos = [...modulos.values()].flat();
  const contar = (estado: EstadoRuta['estado']) => todos.filter((r) => r.estado === estado).length;
  return {
    modulos,
    cubiertas: contar('cubierta'),
    excluidas: contar('excluida'),
    pendientes: contar('pendiente'),
    inconsistencias: [
      ...[...porLlave.keys()]
        .filter((l) => !existentes.has(l))
        .map((l) => `Exclusión sin ruta en la foto: ${l}`),
      ...[...llavesUsadas]
        .filter((l) => !existentes.has(l))
        .map((l) => `Ruta usada en la web que no está en la foto: ${l}`),
    ],
  };
}
