import { screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { renderizar } from '../../test/renderizar';
import { useParametrosUrl } from './useParametrosUrl';

const consultaSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  texto: z.string().max(20).optional(),
});

function Valores() {
  const { valores } = useParametrosUrl(consultaSchema);
  return <p>{JSON.stringify(valores)}</p>;
}

const valoresEn = (ruta: string) => {
  renderizar(<Valores />, { ruta });
  return JSON.parse(screen.getByText(/pagina/).textContent) as Record<string, unknown>;
};

describe('useParametrosUrl: casos borde', () => {
  it.each(['?pagina=0', '?pagina=-1', '?pagina=1.5', '?pagina=abc', '?pagina='])(
    '%s cae a la página 1',
    (busqueda) => {
      expect(valoresEn(`/${busqueda}`)).toEqual({ pagina: 1 });
    },
  );

  it('acepta lo mismo que el esquema del backend: «1e3» es la página 1000 (z.coerce.number)', () => {
    expect(valoresEn('/?pagina=1e3')).toEqual({ pagina: 1000 });
  });

  it('un parámetro repetido toma el primero', () => {
    expect(valoresEn('/?pagina=2&pagina=3')).toEqual({ pagina: 2 });
  });

  it('las claves peligrosas de la URL no entran a los valores ni al prototipo', () => {
    const valores = valoresEn('/?__proto__=x&constructor=y&pagina=2');

    expect(valores).toEqual({ pagina: 2 });
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });

  it('conserva tildes, ñ y emojis del texto libre', () => {
    expect(valoresEn(`/?texto=${encodeURIComponent('niño cámara 👟')}`)).toEqual({
      pagina: 1,
      texto: 'niño cámara 👟',
    });
  });

  it('un texto más largo que el máximo cae a su valor por defecto', () => {
    expect(valoresEn(`/?texto=${'a'.repeat(21)}`)).toEqual({ pagina: 1 });
  });

  it('un esquema con un valor que no se puede escribir en la URL falla con un mensaje claro', async () => {
    const conObjeto = z.object({
      pagina: z.coerce.number().int().min(1).default(1),
      rango: z.object({ desde: z.string() }).optional(),
    });
    let error: unknown = null;
    function Escritor() {
      const { cambiar } = useParametrosUrl(conObjeto);
      return (
        <button
          type="button"
          onClick={() => {
            try {
              cambiar({ rango: { desde: '2026-11-01' } });
            } catch (capturado) {
              error = capturado;
            }
          }}
        >
          Cambiar
        </button>
      );
    }
    const { usuario } = renderizar(<Escritor />);

    await usuario.click(screen.getByRole('button', { name: 'Cambiar' }));

    expect(String(error)).toMatch(/no sabe escribir «rango» en la URL/);
  });

  it('cambiar conserva su identidad entre renders mientras la URL no cambia', async () => {
    const identidades = new Set<unknown>();
    function Observador() {
      const { cambiar } = useParametrosUrl(consultaSchema);
      const [, forzar] = useState(0);
      identidades.add(cambiar);
      return (
        <button
          type="button"
          onClick={() => {
            forzar((n) => n + 1);
          }}
        >
          Render
        </button>
      );
    }
    const { usuario } = renderizar(<Observador />);
    const antes = identidades.size;

    await usuario.click(screen.getByRole('button', { name: 'Render' }));
    await usuario.click(screen.getByRole('button', { name: 'Render' }));

    expect(identidades.size).toBe(antes);
  });
});
