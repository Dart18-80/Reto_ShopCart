import { registroSchema } from '@shopcart/shared';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { useFormularioApi } from '../../../shared/hooks/useFormularioApi';
import { Button } from '../../../shared/ui/button';
import { Form } from '../../../shared/ui/form';
import { useRegistrarse } from '../hooks/useRegistrarse';

/** El mismo esquema que valida la API (FE-03): una contraseña sin números se rechaza aquí con su mensaje. */
export function FormularioRegistro() {
  const formulario = useFormularioApi({
    esquema: registroSchema,
    mutacion: useRegistrarse(),
    valoresIniciales: { nombre: '', correo: '', contrasena: '' },
    // Un correo ya registrado es un problema de ese campo, no del formulario.
    campoPorCodigo: { CORREO_EN_USO: 'correo' },
  });

  return (
    <Form {...formulario.form}>
      <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
        <AvisoFormulario error={formulario.errorGeneral} />
        <CampoFormulario nombre="nombre" etiqueta="Nombre" autoComplete="name" />
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
          autoComplete="new-password"
          descripcion="Mínimo 8 caracteres, con letras y números."
        />
        <CampoFormulario
          nombre="telefono"
          etiqueta="Teléfono (opcional)"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          descripcion="8 dígitos, para avisarte de tu pedido."
          vacio="ausente"
        />
        <Button
          type="submit"
          cargando={formulario.enviando}
          disabled={formulario.enviando}
          className="w-full"
        >
          Crear cuenta
        </Button>
      </form>
    </Form>
  );
}
