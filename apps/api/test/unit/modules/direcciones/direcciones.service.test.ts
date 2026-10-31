import { describe, expect, it, vi } from 'vitest';
import type { DireccionesRepository } from '../../../../src/modules/direcciones/direcciones.repository.js';
import { crearDireccionesService } from '../../../../src/modules/direcciones/direcciones.service.js';
import type {
  DatosDireccion,
  Direccion,
} from '../../../../src/modules/direcciones/direcciones.types.js';
import { AppError } from '../../../../src/shared/errors/index.js';

const DIRECCION: Direccion = {
  idDireccion: 3,
  alias: 'Casa',
  nombreRecibe: 'Ana Pérez',
  telefonoRecibe: '55554444',
  municipio: {
    idMunicipio: 5,
    nombre: 'Mixco',
    departamento: { idDepartamento: 1, nombre: 'Guatemala' },
  },
  direccionLinea: '5a avenida 10-20',
  referencia: 'Portón negro',
  esPredeterminada: true,
};

function preparar(propia: Direccion | null = DIRECCION) {
  const repositorio = {
    listarPropias: vi.fn(() => Promise.resolve([DIRECCION])),
    obtenerPropia: vi.fn((_id: number) => Promise.resolve(propia)),
    crear: vi.fn((_datos: DatosDireccion) => Promise.resolve(DIRECCION)),
    actualizar: vi.fn((_id: number, _datos: DatosDireccion) => Promise.resolve(DIRECCION)),
    eliminar: vi.fn((_id: number) => Promise.resolve()),
    listarDepartamentos: vi.fn(() => Promise.resolve([])),
    listarMunicipios: vi.fn((_id: number) => Promise.resolve([])),
  } satisfies DireccionesRepository;
  return { servicio: crearDireccionesService({ repositorio }), repositorio };
}

describe('direcciones.service (E2-H05, RF-01)', () => {
  it('una dirección ajena o inexistente responde NO_ENCONTRADO', async () => {
    const { servicio } = preparar(null);

    await expect(servicio.obtener(99)).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
    await expect(servicio.obtener(99)).rejects.toBeInstanceOf(AppError);
  });

  it('editar una dirección ajena no llega al SP de actualización', async () => {
    const { servicio, repositorio } = preparar(null);

    await expect(servicio.actualizar(99, { nombreRecibe: 'Intruso' })).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
    });
    expect(repositorio.actualizar).not.toHaveBeenCalled();
  });

  it('PATCH conserva lo que no llega y quita alias y referencia con null', async () => {
    const { servicio, repositorio } = preparar();

    await servicio.actualizar(3, { nombreRecibe: 'Beto', alias: null, referencia: null });

    expect(repositorio.actualizar).toHaveBeenCalledWith(3, {
      alias: null,
      nombreRecibe: 'Beto',
      telefonoRecibe: '55554444',
      idMunicipio: 5,
      direccionLinea: '5a avenida 10-20',
      referencia: null,
      esPredeterminada: true,
    });
  });

  it('crear sin alias ni referencia los envía como null', async () => {
    const { servicio, repositorio } = preparar();

    await servicio.crear({
      nombreRecibe: 'Ana',
      telefonoRecibe: '55554444',
      idMunicipio: 5,
      direccionLinea: 'Zona 1',
      esPredeterminada: false,
    });

    expect(repositorio.crear).toHaveBeenCalledWith(
      expect.objectContaining({ alias: null, referencia: null }),
    );
  });
});
