import { consultaPaginacionSchema } from '@shopcart/shared';
import { Link } from 'react-router';
import { Actualizando } from '../../../shared/componentes/Actualizando';
import { EstadoVista } from '../../../shared/componentes/EstadoVista';
import { Paginacion } from '../../../shared/componentes/Paginacion';
import { usePaginaEnRango } from '../../../shared/hooks/usePaginaEnRango';
import { useParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { Button } from '../../../shared/ui/button';
import { TarjetaPedido } from '../componentes/TarjetaPedido';
import { useMisPedidos } from '../hooks/useMisPedidos';

const SIN_PEDIDOS = {
  titulo: 'Todavía no tienes pedidos',
  descripcion: 'Cuando compres, tus pedidos aparecen aquí.',
  accion: (
    <Button asChild variant="outline" size="sm">
      <Link to="/">Ver el catálogo</Link>
    </Button>
  ),
};

/** M5-H01 (Figma 47:1063 y 47:1153): `/pedidos`, los del Cliente del token (RF-01), paginados por el servidor. */
export function MisPedidosPagina() {
  useTituloPagina('Mis pedidos');
  const parametros = useParametrosUrl(consultaPaginacionSchema);
  const pedidos = useMisPedidos(parametros.valores);
  usePaginaEnRango(pedidos, parametros);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="titulo-1">Mis pedidos</h1>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
        <EstadoVista consulta={pedidos} vacio={SIN_PEDIDOS}>
          {({ datos, paginacion }) => (
            <>
              <ul aria-label="Pedidos" className="flex flex-col gap-3">
                {datos.map((pedido) => (
                  <TarjetaPedido key={pedido.idPedido} pedido={pedido} />
                ))}
              </ul>
              <Actualizando activo={pedidos.isPlaceholderData} />
              <Paginacion
                paginacion={paginacion}
                onPagina={(pagina) => {
                  parametros.cambiar({ pagina });
                }}
              />
            </>
          )}
        </EstadoVista>
      </div>
    </div>
  );
}
