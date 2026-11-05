import { useCarrito } from '../hooks/useCarrito';

/**
 * F1-H05, M3-H02: la cantidad del ícono del carrito en el encabezado es `resumen.unidades` de la misma consulta
 * del carrito. Sin unidades (o mientras carga) no se muestra nada.
 */
export function ContadorCarrito() {
  const unidades = useCarrito().data?.resumen.unidades ?? 0;
  if (unidades === 0) return null;
  return (
    <span className="bg-primary text-primary-foreground texto-nota flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5">
      {unidades}
      <span className="sr-only">{unidades === 1 ? ' unidad' : ' unidades'}</span>
    </span>
  );
}
