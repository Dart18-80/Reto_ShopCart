import { z } from 'zod';

/** Un campo que cambió, como lo muestra la bitácora: «antes → después». */
export interface CambioDeCampo {
  campo: string;
  antes: string;
  despues: string;
}

// El trigger guarda un objeto JSON con columnas no sensibles (M-01).
const valoresSchema = z.record(z.string(), z.unknown());

/** Un valor que no es un objeto (el contrato admite cualquier JSON) se muestra entero bajo este nombre. */
export const CAMPO_DEL_VALOR = '(valor)';
/** El campo no existe de ese lado (una creación, una eliminación o una columna que el trigger no registró). */
const AUSENTE = '—';

const valoresDe = (json: unknown): Record<string, unknown> => {
  if (json === null || json === undefined) return {};
  const objeto = valoresSchema.safeParse(json);
  return objeto.success ? objeto.data : { [CAMPO_DEL_VALOR]: json };
};

// null es un valor (se escribe «null»); un texto se escribe tal cual y lo demás como JSON.
const comoTexto = (presente: boolean, valor: unknown): string => {
  if (!presente) return AUSENTE;
  return typeof valor === 'string' ? valor : JSON.stringify(valor);
};

/**
 * M10-H02: los campos que difieren entre el valor anterior y el nuevo, en el orden en que aparecen. Se comparan los
 * valores crudos (1 y "1" son distintos, null y ausente también); el texto solo es para mostrarlos. Una creación o
 * una eliminación muestra todos sus campos con «—» del otro lado. Aquí no se interpreta ningún valor.
 */
export function cambiosDe(valorAnterior: unknown, valorNuevo: unknown): CambioDeCampo[] {
  const antes = valoresDe(valorAnterior);
  const despues = valoresDe(valorNuevo);
  const campos = [...new Set([...Object.keys(antes), ...Object.keys(despues)])];
  return campos
    .filter(
      (campo) =>
        campo in antes !== campo in despues ||
        JSON.stringify(antes[campo]) !== JSON.stringify(despues[campo]),
    )
    .map((campo) => ({
      campo,
      antes: comoTexto(campo in antes, antes[campo]),
      despues: comoTexto(campo in despues, despues[campo]),
    }));
}
