import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import {
  categoriaAdminDePrueba,
  simularCatalogoAdmin,
} from '../../../test/handlers/catalogo-admin';
import { cuponDePrueba, simularCupones } from '../../../test/handlers/cupones';
import { renderizarRutas } from '../../../test/renderizar';

const abrir = (rol: 'Administrador' | 'Operador' = 'Administrador') =>
  renderizarRutas(crearRutas(), { ruta: '/backoffice/cupones', rol });

const PORCENTAJE = cuponDePrueba();
const FIJO = cuponDePrueba({
  idCupon: 6,
  codigo: 'BIENVENIDA',
  descripcion: 'Primera compra',
  tipo: 'MontoFijo',
  valor: '25.00',
  montoMaximoDescuento: null,
  montoMinimoCompra: '150.00',
  categoria: { idCategoria: 2, nombre: 'Accesorios' },
  usosComprometidos: 0,
  usado: false,
  activo: false,
});

function preparar(errores = {}) {
  simularCatalogoAdmin([
    categoriaAdminDePrueba(),
    categoriaAdminDePrueba({ idCategoria: 2, nombre: 'Accesorios' }),
  ]);
  return simularCupones([PORCENTAJE, FIJO], errores);
}

type Usuario = ReturnType<typeof abrir>['usuario'];

// Pegar en lugar de teclear letra por letra: el formulario tiene muchos campos y la prueba mide el flujo, no el
// tecleo.
async function escribir(usuario: Usuario, campo: HTMLElement, texto: string) {
  await usuario.click(campo);
  await usuario.paste(texto);
}

/** Lo mínimo para que el alta pase el esquema compartido, además de lo que cada prueba escribe. */
async function llenarAlta(usuario: Usuario, elemento: HTMLElement) {
  const dialogo = within(elemento);
  await escribir(usuario, dialogo.getByLabelText('Descripción'), 'Campaña de prueba');
  await escribir(usuario, dialogo.getByLabelText('Vigente desde'), '2026-12-01T00:00');
  await escribir(usuario, dialogo.getByLabelText('Vigente hasta'), '2026-12-25T23:59');
  await escribir(usuario, dialogo.getByLabelText('Límite de usos'), '50');
}

const fila = async (codigo: string) =>
  within((await screen.findByText(codigo)).closest('tr') ?? document.body);

describe('CuponesPagina (M9-H01)', () => {
  it('la tabla: código, descuento tal como llega, alcance, vigencia, usos de su límite y estado', async () => {
    preparar();
    abrir();

    const verano = await fila('VERANO10');
    expect(verano.getByText('10 % hasta Q50.00')).toBeInTheDocument();
    expect(verano.getByText('Toda la tienda')).toBeInTheDocument();
    expect(verano.getByText('1 nov 2026 – 30 nov 2026')).toBeInTheDocument();
    expect(verano.getByText('3 de 100')).toBeInTheDocument();
    expect(verano.getByText('Activo')).toBeInTheDocument();
    const bienvenida = await fila('BIENVENIDA');
    expect(bienvenida.getByText('Q25.00')).toBeInTheDocument();
    expect(bienvenida.getByText('Compra mínima Q150.00')).toBeInTheDocument();
    expect(bienvenida.getByText('Accesorios')).toBeInTheDocument();
    expect(bienvenida.getByRole('button', { name: 'Activar BIENVENIDA' })).toBeInTheDocument();
  });

  it('ordenar por usos y filtrar por estado van en la URL y al servidor', async () => {
    const { consultas } = preparar();
    const { usuario, router } = abrir();

    const tabla = within(await screen.findByRole('table', { name: 'Cupones' }));
    await usuario.click(tabla.getByRole('button', { name: /Usos/ }));
    await usuario.selectOptions(screen.getByLabelText('Estado'), 'Inactivos');

    await waitFor(() => {
      expect(Object.fromEntries(consultas.at(-1) ?? [])).toMatchObject({
        orden: 'usos',
        activo: 'false',
      });
    });
    expect(router.state.location.search).toContain('activo=false');
  });

  it('crear: los montos y porcentajes viajan como texto y la vigencia en hora de Guatemala (FE-10)', async () => {
    const { recibidos } = preparar();
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Nuevo cupón' }));
    const dialogo = within(screen.getByRole('dialog', { name: 'Nuevo cupón' }));
    await escribir(usuario, dialogo.getByLabelText('Código'), 'navidad15');
    await escribir(usuario, dialogo.getByLabelText('Descripción'), 'Navidad en accesorios');
    await escribir(usuario, dialogo.getByLabelText('Valor'), '15');
    await escribir(usuario, dialogo.getByLabelText('Tope de descuento (opcional)'), '80');
    await usuario.selectOptions(await dialogo.findByLabelText('Alcance'), 'Accesorios');
    await escribir(usuario, dialogo.getByLabelText('Vigente desde'), '2026-12-01T00:00');
    await escribir(usuario, dialogo.getByLabelText('Vigente hasta'), '2026-12-25T23:59');
    await escribir(usuario, dialogo.getByLabelText('Límite de usos'), '50');
    await usuario.click(dialogo.getByRole('button', { name: 'Crear cupón' }));

    await waitFor(() => {
      expect(recibidos).toEqual([
        {
          metodo: 'POST',
          ruta: 'crear',
          cuerpo: {
            codigo: 'navidad15',
            descripcion: 'Navidad en accesorios',
            tipo: 'Porcentaje',
            valor: '15',
            montoMaximoDescuento: '80',
            montoMinimoCompra: '0.00',
            idCategoria: 2,
            fechaInicio: '2026-12-01T00:00:00-06:00',
            fechaFin: '2026-12-25T23:59:00-06:00',
            limiteUsosTotal: 50,
            limiteUsosPorCliente: 1,
            activo: true,
          },
        },
      ]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('un monto fijo no tiene tope, y un código repetido (409) marca el campo Código', async () => {
    preparar({
      'POST crear': {
        status: 409,
        codigo: 'CUPON_CODIGO_DUPLICADO',
        mensaje: 'Ya existe un cupón con ese código.',
      },
    });
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Nuevo cupón' }));
    const dialogo = within(screen.getByRole('dialog'));
    await usuario.selectOptions(dialogo.getByLabelText('Tipo'), 'Monto fijo');
    expect(dialogo.queryByLabelText('Tope de descuento (opcional)')).not.toBeInTheDocument();
    await escribir(usuario, dialogo.getByLabelText('Código'), 'VERANO10');
    await escribir(usuario, dialogo.getByLabelText('Descripción'), 'Repetido');
    await escribir(usuario, dialogo.getByLabelText('Valor'), '25');
    await escribir(usuario, dialogo.getByLabelText('Vigente desde'), '2026-12-01T00:00');
    await escribir(usuario, dialogo.getByLabelText('Vigente hasta'), '2026-12-25T23:59');
    await escribir(usuario, dialogo.getByLabelText('Límite de usos'), '50');
    await usuario.click(dialogo.getByRole('button', { name: 'Crear cupón' }));

    expect(await dialogo.findByText('Ya existe un cupón con ese código.')).toBeInTheDocument();
    expect(dialogo.getByLabelText('Código')).toHaveAttribute('aria-invalid', 'true');
  });

  it('un porcentaje de más de 100 lo marca el mismo esquema que la API, sin enviarlo', async () => {
    const { recibidos } = preparar();
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Nuevo cupón' }));
    const dialogo = within(screen.getByRole('dialog'));
    await llenarAlta(usuario, screen.getByRole('dialog'));
    await escribir(usuario, dialogo.getByLabelText('Código'), 'MUCHO');
    await escribir(usuario, dialogo.getByLabelText('Valor'), '150');
    await usuario.click(dialogo.getByRole('button', { name: 'Crear cupón' }));

    expect(await dialogo.findByText('Un porcentaje no puede pasar de 100.')).toBeInTheDocument();
    expect(recibidos).toEqual([]);
  });

  it('editar un cupón usado: 409 CUPON_USADO_NO_EDITABLE con el mensaje del backend en el aviso', async () => {
    preparar({
      'PATCH editar': {
        status: 409,
        codigo: 'CUPON_USADO_NO_EDITABLE',
        mensaje: 'El cupón ya se usó: solo se pueden cambiar su vigencia, sus límites y su estado.',
        detalles: { campo: 'valor' },
      },
    });
    const { usuario } = abrir();

    await usuario.click((await fila('VERANO10')).getByRole('button', { name: 'Editar VERANO10' }));
    const dialogo = within(screen.getByRole('dialog', { name: 'Editar VERANO10' }));
    expect(dialogo.getByLabelText('Valor')).toHaveValue('10.00');
    expect(dialogo.getByLabelText('Vigente desde')).toHaveValue('2026-11-01T00:00');
    await usuario.clear(dialogo.getByLabelText('Valor'));
    await escribir(usuario, dialogo.getByLabelText('Valor'), '20');
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar cambios' }));

    expect(await dialogo.findByRole('alert')).toHaveTextContent(
      'El cupón ya se usó: solo se pueden cambiar su vigencia, sus límites y su estado.',
    );
  });

  it('bajar el límite por debajo de los usos muestra el mensaje en el límite, con los usos comprometidos', async () => {
    const { recibidos } = preparar({
      'PATCH editar': {
        status: 422,
        codigo: 'CUPON_LIMITE_BAJO_USOS',
        mensaje: 'El límite de usos no puede ser menor que los usos ya comprometidos.',
        detalles: { usosComprometidos: 3 },
      },
    });
    const { usuario } = abrir();

    await usuario.click((await fila('VERANO10')).getByRole('button', { name: 'Editar VERANO10' }));
    const dialogo = within(screen.getByRole('dialog'));
    await usuario.clear(dialogo.getByLabelText('Límite de usos'));
    await escribir(usuario, dialogo.getByLabelText('Límite de usos'), '2');
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar cambios' }));

    expect(
      await dialogo.findByText(
        'El límite de usos no puede ser menor que los usos ya comprometidos. Ya hay 3 comprometidos.',
      ),
    ).toBeInTheDocument();
    expect(recibidos[0]).toMatchObject({
      metodo: 'PATCH',
      cuerpo: {
        limiteUsosTotal: 2,
        valor: '10.00',
        montoMaximoDescuento: '50.00',
        idCategoria: null,
      },
    });
  });

  it('un 400 con detalles.errores (un CHECK de la base) marca su campo', async () => {
    preparar({
      'PATCH editar': {
        status: 400,
        codigo: 'PARAMETRO_INVALIDO',
        mensaje: 'La fecha final debe ser posterior a la inicial.',
        detalles: {
          errores: [
            { campo: 'body.fechaFin', mensaje: 'La fecha final debe ser posterior a la inicial.' },
          ],
        },
      },
    });
    const { usuario } = abrir();

    await usuario.click((await fila('VERANO10')).getByRole('button', { name: 'Editar VERANO10' }));
    const dialogo = within(screen.getByRole('dialog'));
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar cambios' }));

    expect(
      await dialogo.findByText('La fecha final debe ser posterior a la inicial.'),
    ).toBeInTheDocument();
    expect(dialogo.getByLabelText('Vigente hasta')).toHaveAttribute('aria-invalid', 'true');
  });

  it('activar un cupón inactivo espera al backend y la lista lo muestra', async () => {
    const { recibidos } = preparar();
    const { usuario } = abrir();

    await usuario.click(
      (await fila('BIENVENIDA')).getByRole('button', { name: 'Activar BIENVENIDA' }),
    );

    await waitFor(() => {
      expect(recibidos).toEqual([{ metodo: 'POST', ruta: 'activar' }]);
    });
    expect(
      await screen.findByRole('button', { name: 'Desactivar BIENVENIDA' }),
    ).toBeInTheDocument();
  });

  it('un Operador ve «Sin permiso»', async () => {
    abrir('Operador');

    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });
});
