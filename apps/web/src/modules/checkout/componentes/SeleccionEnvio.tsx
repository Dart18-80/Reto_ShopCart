import { RadioGroup } from '../../../shared/ui/radio-group';
import { diasDeEntrega, type MetodoEnvio } from '../../envios';
import { CostoEnvio } from './CostoEnvio';
import { Opcion } from './Opcion';

interface PropsSeleccionEnvio {
  metodos: MetodoEnvio[];
  elegido: MetodoEnvio;
  alElegir: (idMetodoEnvio: number) => void;
}

/** M4-H02: el método de envío con su plazo y su costo para este carrito (N-04, calculado en el backend). */
export function SeleccionEnvio({ metodos, elegido, alElegir }: PropsSeleccionEnvio) {
  return (
    <RadioGroup
      aria-label="Método de envío"
      value={String(elegido.idMetodoEnvio)}
      onValueChange={(valor) => {
        alElegir(Number(valor));
      }}
    >
      {metodos.map((metodo) => (
        <Opcion
          key={metodo.idMetodoEnvio}
          valor={String(metodo.idMetodoEnvio)}
          titulo={metodo.nombre}
          detalle={`Llega en ${diasDeEntrega(metodo.diasMin, metodo.diasMax)}.`}
          extra={<CostoEnvio metodo={metodo} />}
        />
      ))}
    </RadioGroup>
  );
}
