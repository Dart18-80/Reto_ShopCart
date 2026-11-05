import { Monto } from '../../../shared/componentes/Monto';
import type { MetodoEnvio } from '../../envios';

/** El costo de un método tal como llega: «Gratis» cuando el backend dice que el carrito alcanzó el envío gratis (N-04). */
export function CostoEnvio({ metodo }: { metodo: Pick<MetodoEnvio, 'costo' | 'envioGratis'> }) {
  return metodo.envioGratis ? 'Gratis' : <Monto valor={metodo.costo} />;
}
