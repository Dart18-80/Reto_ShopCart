import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearProyectoDeLint, type ProyectoDeLint } from './lintTemporal';

// Decisión del PO (F1-H01): eslint-plugin-jsx-a11y 6.10.2 declara compatibilidad hasta ESLint 9; esta prueba
// demuestra que con ESLint 10 sus reglas sí corren con la configuración real (en un proyecto temporal fuera de src/).

let proyecto: ProyectoDeLint;

async function reglasIncumplidas(codigo: string): Promise<string[]> {
  const ruta = `shared/componentes/PruebaA11y${randomUUID().slice(0, 8)}.tsx`;
  await proyecto.escribir(ruta, codigo);
  return (await proyecto.mensajes(ruta)).map((mensaje) => mensaje.ruleId ?? '');
}

beforeAll(async () => {
  proyecto = await crearProyectoDeLint((ruleId) => ruleId.startsWith('jsx-a11y/'));
});

afterAll(async () => {
  await proyecto.borrar();
});

describe('accesibilidad en el lint (jsx-a11y con ESLint 10)', () => {
  it('una imagen sin alt hace fallar el lint', async () => {
    const reglas = await reglasIncumplidas(
      'export function Logo() {\n  return <img src="/logo.svg" />;\n}\n',
    );

    expect(reglas).toContain('jsx-a11y/alt-text');
  });

  it('la misma imagen con alt pasa', async () => {
    const reglas = await reglasIncumplidas(
      'export function Logo() {\n  return <img src="/logo.svg" alt="ShopCart" />;\n}\n',
    );

    expect(reglas).toEqual([]);
  });
});
