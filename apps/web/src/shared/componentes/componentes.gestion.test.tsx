import { rangoDeFechasSchema } from '@shopcart/shared';
import { useQuery } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderizar } from '../../test/renderizar';
import { errorApiDePrueba } from '../../test/errores';
import { useParametrosUrl } from '../hooks/useParametrosUrl';
import { Button } from '../ui/button';
import { DialogoConfirmacion } from './DialogoConfirmacion';
import { AvisoConsultaFallida } from './EstadoVista';
import { FiltroRangoFechas } from './FiltroRangoFechas';

const ERROR = errorApiDePrueba('Algo salió mal.');

describe('DialogoConfirmacion (fix de M6)', () => {
  const abrir = (alConfirmar: () => void) =>
    renderizar(
      <DialogoConfirmacion
        titulo="¿Eliminar Gorras?"
        descripcion="No se puede deshacer."
        textoConfirmar="Eliminar categoría"
        disparador={<Button>Eliminar</Button>}
        alConfirmar={alConfirmar}
      />,
    );

  it('«Cancelar» cierra sin hacer nada', async () => {
    const alConfirmar = vi.fn();
    const { usuario } = abrir(alConfirmar);

    await usuario.click(screen.getByRole('button', { name: 'Eliminar' }));
    await usuario.click(
      within(screen.getByRole('alertdialog', { name: '¿Eliminar Gorras?' })).getByRole('button', {
        name: 'Cancelar',
      }),
    );

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(alConfirmar).not.toHaveBeenCalled();
  });

  it('confirmar ejecuta la acción una vez y cierra', async () => {
    const alConfirmar = vi.fn();
    const { usuario } = abrir(alConfirmar);

    await usuario.click(screen.getByRole('button', { name: 'Eliminar' }));
    await usuario.click(screen.getByRole('button', { name: 'Eliminar categoría' }));

    expect(alConfirmar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

function ConsultaAuxiliar({ consultar }: { consultar: () => Promise<string[]> }) {
  const consulta = useQuery({ queryKey: ['auxiliar'], queryFn: consultar });
  return <AvisoConsultaFallida consulta={consulta} titulo="No pudimos cargar las categorías." />;
}

describe('AvisoConsultaFallida (fix de M6)', () => {
  it('sin error no muestra nada', async () => {
    const consultar = vi.fn(() => Promise.resolve(['Camisas']));
    renderizar(<ConsultaAuxiliar consultar={consultar} />);

    await waitFor(() => {
      expect(consultar).toHaveBeenCalled();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('con error dice qué no cargó, el mensaje del backend y Reintentar vuelve a pedirla', async () => {
    const consultar = vi
      .fn<() => Promise<string[]>>()
      .mockRejectedValueOnce(ERROR)
      .mockResolvedValue(['Camisas']);
    const { usuario } = renderizar(<ConsultaAuxiliar consultar={consultar} />);

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('No pudimos cargar las categorías.');
    expect(aviso).toHaveTextContent('Algo salió mal.');
    await usuario.click(within(aviso).getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(consultar).toHaveBeenCalledTimes(2);
  });
});

function Rango() {
  const parametros = useParametrosUrl(rangoDeFechasSchema);
  return <FiltroRangoFechas parametros={parametros} />;
}

describe('FiltroRangoFechas (M8-H02)', () => {
  it('escribe cada extremo en la URL como AAAA-MM-DD y lo borra al vaciarlo', async () => {
    const { usuario, router } = renderizar(<Rango />, { ruta: '/rango' });

    await usuario.type(screen.getByLabelText('Desde'), '2026-11-01');
    await waitFor(() => {
      expect(router.state.location.search).toBe('?desde=2026-11-01');
    });
    await usuario.clear(screen.getByLabelText('Desde'));
    await waitFor(() => {
      expect(router.state.location.search).toBe('');
    });
  });

  it('un rango invertido en la URL descarta «Desde», como lo haría el backend con un 400', () => {
    renderizar(<Rango />, { ruta: '/rango?desde=2026-11-09&hasta=2026-11-01' });

    expect(screen.getByLabelText('Desde')).toHaveValue('');
    expect(screen.getByLabelText('Hasta')).toHaveValue('2026-11-01');
  });
});
