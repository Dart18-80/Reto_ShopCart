import { Link, Navigate } from 'react-router';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { FormularioRegistro } from '../componentes/FormularioRegistro';
import { TarjetaCuenta } from '../componentes/TarjetaCuenta';
import { useBusquedaConVolver, useDestinoAlIngresar } from '../hooks/useDestinoAlIngresar';

/** El registro no tiene frame propio: usa la tarjeta de Ingresar con sus campos (M1). */
export function RegistroPagina() {
  useTituloPagina('Crear cuenta');
  const destino = useDestinoAlIngresar();
  const conVolver = useBusquedaConVolver();
  if (destino) return <Navigate to={destino} replace />;

  return (
    <TarjetaCuenta
      titulo="Crea tu cuenta"
      subtitulo="Para pagar y dar seguimiento a tus pedidos."
      pie={
        <>
          ¿Ya tienes cuenta?
          <Link to={`/ingresar${conVolver}`} className="texto-pequeno-fuerte text-primary">
            Ingresa
          </Link>
        </>
      }
    >
      <FormularioRegistro />
    </TarjetaCuenta>
  );
}
