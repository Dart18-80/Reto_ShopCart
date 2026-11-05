import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { crearProyectoDeLint, type ProyectoDeLint } from './lintTemporal';

// FE-09: el lint real del proyecto sobre módulos de prueba, porque la regla clasifica los archivos por su ruta.
// Viven en un proyecto temporal fuera de src/ (os.tmpdir()). Mismo mecanismo que apps/api/test/unit/fronteras.test.ts.

const REGLA = 'boundaries/dependencies';

/** Un módulo completo: cada capa exporta algo que las demás pueden importar. */
const CAPAS = {
  'index.ts': 'export const publico = 1;\n',
  'x.api.ts': 'export const llamada = 1;\n',
  'x.keys.ts': 'export const llaves = 1;\n',
  'hooks/useX.ts': 'export const gancho = 1;\n',
  'componentes/Pieza.tsx': 'export const pieza = 1;\n',
  'paginas/XPagina.tsx': 'export const pagina = 1;\n',
};

const a = 'prueba-a';
const b = 'prueba-b';
let proyecto: ProyectoDeLint;

/** Escribe `codigo` en `archivo` (relativo a src) y devuelve los mensajes de la regla de fronteras. */
async function erroresDeFrontera(archivo: string, codigo: string): Promise<string[]> {
  await proyecto.escribir(archivo, codigo);
  return (await proyecto.mensajes(archivo))
    .filter((mensaje) => mensaje.ruleId === REGLA)
    .map((mensaje) => mensaje.message);
}

const importar = (nombre: string, ruta: string) =>
  `import { ${nombre} } from '${ruta}';\n\nexport const usado = ${nombre};\n`;
const importarTipo = (ruta: string) =>
  `import type * as tipos from '${ruta}';\n\nexport type Usado = typeof tipos;\n`;

const ESPERA_LINT_MS = 60_000;

beforeAll(async () => {
  proyecto = await crearProyectoDeLint((ruleId) => ruleId === REGLA);
  for (const modulo of [a, b]) {
    for (const [archivo, contenido] of Object.entries(CAPAS)) {
      await proyecto.escribir(`modules/${modulo}/${archivo}`, contenido);
    }
  }
  await proyecto.escribir('shared/api/prueba-cliente.ts', 'export const api = 1;\n');
}, ESPERA_LINT_MS);

afterAll(async () => {
  await proyecto.borrar();
});

describe('fronteras entre módulos (FE-09)', { timeout: ESPERA_LINT_MS }, () => {
  it('importar un hook de otro módulo hace fallar el lint', async () => {
    const errores = await erroresDeFrontera(
      `modules/${b}/hooks/useOtro.ts`,
      importar('gancho', `../../${a}/hooks/useX`),
    );

    expect(errores).toEqual([expect.stringContaining('FE-09') as unknown]);
  });

  it('importar el index.ts de otro módulo está permitido', async () => {
    const errores = await erroresDeFrontera(
      `modules/${b}/hooks/useOtro.ts`,
      importar('publico', `../../${a}`),
    );

    expect(errores).toEqual([]);
  });

  it('app/ importa las páginas de un módulo para la carga diferida', async () => {
    const errores = await erroresDeFrontera(
      'app/prueba-rutas.ts',
      importar('pagina', `../modules/${a}/paginas/XPagina`),
    );

    expect(errores).toEqual([]);
  });

  it('shared/ no importa módulos, ni siquiera su index.ts', async () => {
    const errores = await erroresDeFrontera(
      'shared/hooks/usePrueba.ts',
      importar('publico', `../../modules/${a}`),
    );

    expect(errores).toEqual([expect.stringContaining('FE-09') as unknown]);
  });

  it('app/ no importa otras capas internas de un módulo', async () => {
    const errores = await erroresDeFrontera(
      'app/prueba-rutas.ts',
      importar('gancho', `../modules/${a}/hooks/useX`),
    );

    expect(errores).toEqual([expect.stringContaining('FE-09') as unknown]);
  });
});

describe(
  'capas dentro de un módulo: paginas → componentes → hooks → api (FE-09)',
  { timeout: ESPERA_LINT_MS },
  () => {
    it.each([
      [
        'un componente importa el cliente api',
        'componentes/Otra.tsx',
        '../../../shared/api/prueba-cliente',
        'api',
      ],
      [
        'una página importa el cliente api',
        'paginas/OtraPagina.tsx',
        '../../../shared/api/prueba-cliente',
        'api',
      ],
      ['un componente importa el archivo .api.ts', 'componentes/Otra.tsx', '../x.api', 'llamada'],
      ['un hook importa un componente', 'hooks/useOtro.ts', '../componentes/Pieza', 'pieza'],
      ['un componente importa una página', 'componentes/Otra.tsx', '../paginas/XPagina', 'pagina'],
      ['el archivo .api.ts importa un hook', 'otra.api.ts', './hooks/useX', 'gancho'],
    ])('%s hace fallar el lint', async (_caso, archivo, ruta, nombre) => {
      const errores = await erroresDeFrontera(`modules/${a}/${archivo}`, importar(nombre, ruta));

      expect(errores).toEqual([expect.stringContaining('FE-09') as unknown]);
    });

    it.each([
      [
        'una página importa un componente',
        'paginas/OtraPagina.tsx',
        '../componentes/Pieza',
        'pieza',
      ],
      ['un componente importa un hook', 'componentes/Otra.tsx', '../hooks/useX', 'gancho'],
      ['un hook importa el archivo .api.ts', 'hooks/useOtro.ts', '../x.api', 'llamada'],
      [
        'el archivo .api.ts importa el cliente api',
        'otra.api.ts',
        '../../shared/api/prueba-cliente',
        'api',
      ],
    ])('%s está permitido', async (_caso, archivo, ruta, nombre) => {
      const errores = await erroresDeFrontera(`modules/${a}/${archivo}`, importar(nombre, ruta));

      expect(errores).toEqual([]);
    });

    it('un componente compartido importa el cliente api: falla', async () => {
      const errores = await erroresDeFrontera(
        'shared/componentes/PruebaPieza.tsx',
        importar('api', '../api/prueba-cliente'),
      );

      expect(errores).toEqual([expect.stringContaining('FE-09') as unknown]);
    });

    it('un componente importa solo tipos de shared/api (ErrorApi): permitido', async () => {
      const errores = await erroresDeFrontera(
        'shared/componentes/PruebaPieza.tsx',
        importarTipo('../api/prueba-cliente'),
      );

      expect(errores).toEqual([]);
    });
  },
);
