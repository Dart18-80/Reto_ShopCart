import { actualizarPerfilSchema } from '@shopcart/shared';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { useFormularioApi } from '../../../shared/hooks/useFormularioApi';
import { Button } from '../../../shared/ui/button';
import { Form } from '../../../shared/ui/form';
import { useActualizarPerfil } from '../hooks/useActualizarPerfil';
import type { Perfil } from '../usuarios.api';

/** Nombre y teléfono; el correo no se edita (N-15). Borrar el teléfono lo quita: se envía `null`. */
export function FormularioDatosPerfil({ perfil }: { perfil: Perfil }) {
  const formulario = useFormularioApi({
    esquema: actualizarPerfilSchema,
    mutacion: useActualizarPerfil(),
    valoresIniciales: { nombre: perfil.nombre, telefono: perfil.telefono },
  });

  return (
    <Form {...formulario.form}>
      <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
        <AvisoFormulario error={formulario.errorGeneral} />
        <p className="flex flex-col gap-1.5">
          <span className="control-etiqueta">Correo electrónico</span>
          <span className="texto-base text-muted-foreground">{perfil.correo}</span>
        </p>
        <CampoFormulario nombre="nombre" etiqueta="Nombre" autoComplete="name" />
        <CampoFormulario
          nombre="telefono"
          etiqueta="Teléfono (opcional)"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          descripcion="8 dígitos, para avisarte de tu pedido."
          vacio="nulo"
        />
        <div>
          <Button
            type="submit"
            cargando={formulario.enviando}
            disabled={formulario.enviando}
            className="px-6"
          >
            Guardar datos
          </Button>
        </div>
      </form>
    </Form>
  );
}
