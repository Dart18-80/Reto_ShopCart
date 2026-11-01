import { describe, expect, it, vi } from 'vitest';
import type { DireccionesRepository } from '../../../../src/modules/direcciones/direcciones.repository.js';
import type { ActualizarDireccion } from '../../../../src/modules/direcciones/direcciones.schemas.js';
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
    actualizar: vi.fn((_id: number, _cambios: ActualizarDireccion) => Promise.resolve(DIRECCION)),
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

  it('PATCH pasa al SP solo lo que llegó, sin leer antes: la mezcla y el dueño los resuelve el SP', async () => {
    const { servicio, repositorio } = preparar();
    const cambios = { nombreRecibe: 'Beto', alias: null, referencia: null };

    await servicio.actualizar(3, cambios);

    expect(repositorio.actualizar).toHaveBeenCalledWith(3, cambios);
    expect(repositorio.obtenerPropia).not.toHaveBeenCalled();
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
