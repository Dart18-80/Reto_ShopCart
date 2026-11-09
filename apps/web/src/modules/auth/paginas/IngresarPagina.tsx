import { Link, Navigate } from 'react-router';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { FormularioIngresar } from '../componentes/FormularioIngresar';
import { TarjetaCuenta } from '../componentes/TarjetaCuenta';
import { useBusquedaConVolver, useDestinoAlIngresar } from '../hooks/useDestinoAlIngresar';
import { RUTAS } from '../../../shared/rutas';

export function IngresarPagina() {
  useTituloPagina('Ingresar');
  const destino = useDestinoAlIngresar();
  const conVolver = useBusquedaConVolver();
  // Con sesión abierta (recién ingresó o ya estaba), lleva al destino: no se queda en el formulario.
  if (destino) return <Navigate to={destino} replace />;

  return (
    <TarjetaCuenta
      titulo="Ingresa a tu cuenta"
      subtitulo="Para pagar y dar seguimiento a tus pedidos."
      pie={
        <>
          ¿No tienes cuenta?
          <Link to={`${RUTAS.registro}${conVolver}`} className="texto-pequeno-fuerte text-primary">
            Crea una
          </Link>
        </>
      }
    >
      <FormularioIngresar />
    </TarjetaCuenta>
  );
}
