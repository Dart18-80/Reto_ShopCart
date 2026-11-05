import { cambiarContrasenaSchema } from '@shopcart/shared';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { useFormularioApi } from '../../../shared/hooks/useFormularioApi';
import { Button } from '../../../shared/ui/button';
import { Form } from '../../../shared/ui/form';
import { useCambiarContrasena } from '../hooks/useCambiarContrasena';

const VACIO = { contrasenaActual: '', contrasenaNueva: '' };

/** Una contraseña actual incorrecta llega como 400 del campo `contrasenaActual` y se marca ahí (M1-H02). */
export function FormularioContrasena() {
  const formulario = useFormularioApi({
    esquema: cambiarContrasenaSchema,
    mutacion: useCambiarContrasena(),
    valoresIniciales: VACIO,
    alTerminar: () => {
      formulario.form.reset(VACIO);
    },
  });

  return (
    <Form {...formulario.form}>
      <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
        <AvisoFormulario error={formulario.errorGeneral} />
        <CampoFormulario
          nombre="contrasenaActual"
          etiqueta="Contraseña actual"
          type="password"
          autoComplete="current-password"
        />
        <CampoFormulario
          nombre="contrasenaNueva"
          etiqueta="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          descripcion="Mínimo 8 caracteres, con letras y números."
        />
        <div>
          <Button
            type="submit"
            disabled={formulario.enviando}
            className="control-boton h-auto px-6 py-3"
          >
            Cambiar contraseña
          </Button>
        </div>
      </form>
    </Form>
  );
}
