import { loginSchema } from '@shopcart/shared';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { useFormularioApi } from '../../../shared/hooks/useFormularioApi';
import { Button } from '../../../shared/ui/button';
import { Form } from '../../../shared/ui/form';
import { useIngresar } from '../hooks/useIngresar';

/** N-15: un 401 nunca dice si falló el correo o la contraseña; va al aviso, no a un campo. */
export function FormularioIngresar() {
  const formulario = useFormularioApi({
    esquema: loginSchema,
    mutacion: useIngresar(),
    valoresIniciales: { correo: '', contrasena: '' },
  });

  return (
    <Form {...formulario.form}>
      <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
        <AvisoFormulario error={formulario.errorGeneral} />
        <CampoFormulario
          nombre="correo"
          etiqueta="Correo electrónico"
          type="email"
          autoComplete="email"
        />
        <CampoFormulario
          nombre="contrasena"
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
        />
        <Button
          type="submit"
          cargando={formulario.enviando}
          disabled={formulario.enviando}
          className="w-full"
        >
          Ingresar
        </Button>
      </form>
    </Form>
  );
}
