import { ErrorMigracion } from './errores.ts';
import type { Script, TipoScript } from './scripts.ts';

export interface ScriptAplicado {
  tipo: TipoScript;
  checksum: Buffer;
}

/**
 * A-09: un V### o S### ya aplicado es inmutable. Si su archivo cambió o desapareció, la base ya no
 * se puede reconstruir desde el repositorio, así que el migrador se detiene antes de aplicar nada.
 */
export function validarIntegridad(scripts: Script[], aplicados: Map<string, ScriptAplicado>): void {
  const enDisco = new Map(scripts.map((script) => [script.nombre, script]));
  const problemas: string[] = [];

  for (const [nombre, aplicado] of aplicados) {
    if (aplicado.tipo === 'R') continue;
    const script = enDisco.get(nombre);
    if (script === undefined) {
      problemas.push(`${nombre} se aplicó pero ya no existe en el repositorio.`);
    } else if (!script.checksum.equals(aplicado.checksum)) {
      problemas.push(
        `${nombre} cambió después de aplicarse (checksum en la base ${corto(aplicado.checksum)}, en disco ${corto(script.checksum)}).`,
      );
    }
  }

  if (problemas.length > 0) {
    throw new ErrorMigracion(
      [
        'Se modificaron scripts versionados que ya estaban aplicados:',
        ...problemas.map((problema) => `  - ${problema}`),
        'Los V### y S### son inmutables: revierte el cambio y crea un script nuevo con el siguiente número.',
      ].join('\n'),
    );
  }
}

/** Devuelve, en orden V → R → S, los scripts nuevos y los R__ cuyo contenido cambió. */
export function planificar(scripts: Script[], aplicados: Map<string, ScriptAplicado>): Script[] {
  return scripts.filter((script) => {
    const aplicado = aplicados.get(script.nombre);
    if (aplicado === undefined) return true;
    return script.tipo === 'R' && !script.checksum.equals(aplicado.checksum);
  });
}

function corto(checksum: Buffer): string {
  return checksum.toString('hex').slice(0, 12);
}

const VERSION = /^[VS](\d{3})__/;

/**
 * A-09: un V### o S### nuevo con número menor que el último aplicado de su tipo se aplicaría fuera de
 * orden (por ejemplo, un V002 creado después de aplicar el V003). Se falla para que se renumere.
 */
export function validarOrden(scripts: Script[], aplicados: Map<string, ScriptAplicado>): void {
  const problemas = (['V', 'S'] as const).flatMap((tipo) => fueraDeOrden(scripts, aplicados, tipo));
  if (problemas.length === 0) return;
  throw new ErrorMigracion(
    [
      'Scripts versionados nuevos con un número menor que el último aplicado:',
      ...problemas.map((problema) => `  - ${problema}`),
      'Renuméralos con un número mayor que el último aplicado.',
    ].join('\n'),
  );
}

function fueraDeOrden(
  scripts: Script[],
  aplicados: Map<string, ScriptAplicado>,
  tipo: 'V' | 'S',
): string[] {
  const delTipo = scripts.filter((script) => script.tipo === tipo);
  const ultimoAplicado = delTipo.filter((script) => aplicados.has(script.nombre)).at(-1);
  if (ultimoAplicado === undefined) return [];
  const limite = version(ultimoAplicado.nombre);
  return delTipo
    .filter((script) => !aplicados.has(script.nombre) && version(script.nombre) < limite)
    .map((script) => `${script.nombre} es anterior a ${ultimoAplicado.nombre}, que ya se aplicó.`);
}

function version(nombre: string): number {
  return Number(VERSION.exec(nombre)?.[1] ?? Number.NaN);
}
