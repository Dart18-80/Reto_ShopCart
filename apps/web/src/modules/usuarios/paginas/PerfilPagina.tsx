import { EstadoVista } from '../../../shared/componentes/EstadoVista';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { FormularioContrasena } from '../componentes/FormularioContrasena';
import { FormularioDatosPerfil } from '../componentes/FormularioDatosPerfil';
import { SeccionPerfil } from '../componentes/SeccionPerfil';
import { usePerfil } from '../hooks/usePerfil';

// El perfil propio siempre existe mientras haya sesión: no tiene estado vacío.
const NUNCA_VACIO = () => false;

export function PerfilPagina() {
  useTituloPagina('Mi perfil');
  const perfil = usePerfil();

  return (
    <>
      <h1 className="titulo-1">Mi perfil</h1>
      <SeccionPerfil titulo="Tus datos">
        <EstadoVista consulta={perfil} vacio={{ titulo: 'Sin datos' }} esVacio={NUNCA_VACIO}>
          {(datos) => <FormularioDatosPerfil perfil={datos} />}
        </EstadoVista>
      </SeccionPerfil>
      <SeccionPerfil titulo="Contraseña">
        <FormularioContrasena />
      </SeccionPerfil>
    </>
  );
}
