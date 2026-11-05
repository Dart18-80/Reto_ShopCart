import { Button } from '../../../shared/ui/button';
import { RadioGroup } from '../../../shared/ui/radio-group';
import { DialogoNuevaDireccion, FormularioNuevaDireccion, type Direccion } from '../../direcciones';
import { Opcion } from './Opcion';

interface PropsSeleccionDireccion {
  direcciones: Direccion[];
  elegida: number | undefined;
  alElegir: (idDireccion: number) => void;
}

const detalleDe = (direccion: Direccion) =>
  `${direccion.nombreRecibe}, ${direccion.telefonoRecibe}. ${direccion.direccionLinea}, ${direccion.municipio.nombre}, ${direccion.municipio.departamento.nombre}.`;

/**
 * M4-H02: la dirección de entrega con Opción (la predeterminada elegida al entrar). Sin direcciones, el paso
 * muestra el formulario para la primera; la nueva queda elegida en cuanto el backend la confirma.
 */
export function SeleccionDireccion({ direcciones, elegida, alElegir }: PropsSeleccionDireccion) {
  const alCrear = (direccion: Direccion) => {
    alElegir(direccion.idDireccion);
  };

  if (direcciones.length === 0) {
    return (
      <section
        aria-labelledby="titulo-primera-direccion"
        className="bg-card flex flex-col gap-4 rounded-lg border p-5"
      >
        <h3 id="titulo-primera-direccion" className="texto-base-fuerte">
          Tu primera dirección
        </h3>
        <FormularioNuevaDireccion alTerminar={alCrear} />
      </section>
    );
  }

  return (
    <>
      <RadioGroup
        aria-label="Dirección de entrega"
        value={elegida === undefined ? '' : String(elegida)}
        onValueChange={(valor) => {
          alElegir(Number(valor));
        }}
      >
        {direcciones.map((direccion) => (
          <Opcion
            key={direccion.idDireccion}
            valor={String(direccion.idDireccion)}
            titulo={direccion.alias ?? direccion.nombreRecibe}
            detalle={detalleDe(direccion)}
          />
        ))}
      </RadioGroup>
      <div>
        <DialogoNuevaDireccion
          alCrear={alCrear}
          disparador={
            <Button variant="outline" className="control-boton h-auto px-6 py-3">
              Agregar dirección
            </Button>
          }
        />
      </div>
    </>
  );
}
