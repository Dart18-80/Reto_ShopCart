import { z } from 'zod';

/** Un campo que cambió, como lo muestra la bitácora: «antes → después». */
export interface CambioDeCampo {
  campo: string;
  antes: string;
  despues: string;
}

// El trigger guarda un objeto JSON con columnas no sensibles (M-01); cualquier otra forma se trata como vacía.
const valoresSchema = z.record(z.string(), z.unknown());

const SIN_VALOR = '—';

const comoTexto = (valor: unknown): string => {
  if (valor === undefined || valor === null) return SIN_VALOR;
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  return JSON.stringify(valor);
};

const valoresDe = (json: unknown): Record<string, unknown> => {
  const resultado = valoresSchema.safeParse(json);
  return resultado.success ? resultado.data : {};
};

/**
 * M10-H02: los campos que difieren entre el valor anterior y el nuevo, en el orden en que aparecen. Una creación
 * (sin anterior) o una eliminación (sin nuevo) muestra todos sus campos con «—» del otro lado. Los valores se
 * escriben tal como los guardó la base: aquí no se interpreta ninguno.
 */
export function cambiosDe(valorAnterior: unknown, valorNuevo: unknown): CambioDeCampo[] {
  const antes = valoresDe(valorAnterior);
  const despues = valoresDe(valorNuevo);
  const campos = [...new Set([...Object.keys(antes), ...Object.keys(despues)])];
  return campos
    .map((campo) => ({ campo, antes: comoTexto(antes[campo]), despues: comoTexto(despues[campo]) }))
    .filter((cambio) => cambio.antes !== cambio.despues);
}
