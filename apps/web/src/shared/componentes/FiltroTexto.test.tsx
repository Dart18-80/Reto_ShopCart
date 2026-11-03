import { textoNvarchar } from '@shopcart/shared';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { renderizar } from '../../test/renderizar';
import { ESPERA_TEXTO_LIBRE_MS } from '../hooks/useDebounce';
import { useParametrosUrl } from '../hooks/useParametrosUrl';
import { FiltroTexto } from './FiltroTexto';

// Como el backend: el texto libre se recorta (textoNvarchar) y tiene un largo máximo.
const consultaSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  texto: textoNvarchar(10).optional(),
});

function Buscador() {
  const parametros = useParametrosUrl(consultaSchema);
  return <FiltroTexto parametros={parametros} campo="texto" etiqueta="Buscar" />;
}

const esperarElDebounce = () =>
  new Promise((resolver) => setTimeout(resolver, ESPERA_TEXTO_LIBRE_MS * 2));

function contarNavegaciones(router: { subscribe: (escuchar: () => void) => () => void }) {
  const cuenta = { total: 0 };
  router.subscribe(() => {
    cuenta.total += 1;
  });
  return cuenta;
}

describe('FiltroTexto', () => {
  it('solo espacios no escribe nada en la URL ni navega en bucle', async () => {
    const { usuario, router } = renderizar(<Buscador />, { ruta: '/productos' });
    const navegaciones = contarNavegaciones(router);

    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar' }), '   ');
    await esperarElDebounce();

    expect(router.state.location.search).toBe('');
    expect(navegaciones.total).toBe(0);
  });

  it('un texto que el esquema rechaza (más largo que el máximo) no navega en bucle', async () => {
    const { usuario, router } = renderizar(<Buscador />, { ruta: '/productos' });
    const navegaciones = contarNavegaciones(router);

    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'demasiado largo');
    await esperarElDebounce();
    await esperarElDebounce();

    expect(navegaciones.total).toBeLessThanOrEqual(1);
  });

  it('con un esquema que recorta, el espacio que se está escribiendo no se borra', async () => {
    const { usuario, router } = renderizar(<Buscador />, { ruta: '/productos' });
    const buscador = screen.getByRole('searchbox', { name: 'Buscar' });

    await usuario.type(buscador, 'gorra ');
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('texto')).toBe('gorra ');
    });
    await esperarElDebounce();
    await usuario.type(buscador, 'azul');

    expect(buscador).toHaveValue('gorra azul');
    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('texto')).toBe('gorra azul');
    });
  });
});
