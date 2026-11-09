import { Aviso } from '../../../shared/componentes/Aviso';
import { formatearMonto } from '../../../shared/formato/monto';
import type { Carrito } from '../carrito.api';

const PORCENTAJE_COMPLETO = 100;

/**
 * FE-10: la única geometría permitida con montos. El ancho de la barra sale de los dos montos del backend; el
 * texto los muestra tal como llegan.
 */
function porcentajeDeAvance(faltante: string, montoMinimo: string): number {
  const minimo = Number(montoMinimo);
  if (minimo <= 0) return PORCENTAJE_COMPLETO;
  return Math.min(
    PORCENTAJE_COMPLETO,
    Math.max(0, (1 - Number(faltante) / minimo) * PORCENTAJE_COMPLETO),
  );
}

/** N-04, M3-H03: cuánto falta para el envío gratis, sobre el total después del cupón. Sin envío gratis, nada. */
export function EnvioGratis({ envioGratis }: { envioGratis: Carrito['resumen']['envioGratis'] }) {
  if (!envioGratis) return null;
  if (envioGratis.alcanzado) return <Aviso tipo="exito">Tu pedido tiene envío gratis.</Aviso>;
  const avance = porcentajeDeAvance(envioGratis.faltante, envioGratis.montoMinimo);
  return (
    <Aviso tipo="info">
      <p>{`Te faltan ${formatearMonto(envioGratis.faltante)} para el envío gratis.`}</p>
      <progress
        aria-label="Avance hacia el envío gratis"
        value={avance}
        max={PORCENTAJE_COMPLETO}
        className="mt-2 h-1.5 w-full appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:bg-[linear-gradient(90deg,color-mix(in_oklab,var(--primary),black_30%),var(--primary))] [&::-webkit-progress-bar]:bg-card [&::-webkit-progress-value]:bg-[linear-gradient(90deg,color-mix(in_oklab,var(--primary),black_30%),var(--primary))] [&::-webkit-progress-value]:transition-[width] [&::-webkit-progress-value]:duration-400 [&::-webkit-progress-value]:ease-salida"
      />
    </Aviso>
  );
}
