import {
  actualizarUsuarioSchema,
  crearUsuarioInternoSchema,
  ROLES_DE_USUARIO,
  ROLES_INTERNOS,
  type RolDeUsuario,
} from '@shopcart/shared';
import { useState, type ReactNode } from 'react';
import type { z } from 'zod';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { CampoOpciones } from '../../../shared/componentes/CampoOpciones';
import { useFormularioApi } from '../../../shared/hooks/useFormularioApi';
import { Button } from '../../../shared/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../../../shared/ui/dialog';
import { Form } from '../../../shared/ui/form';
import { useActualizarUsuario, useCrearUsuario } from '../hooks/useUsuariosAdmin';
import type { UsuarioAdmin } from '../usuarios.api';

const opcionesDe = (roles: readonly RolDeUsuario[]) =>
  roles.map((rol) => ({ valor: rol, etiqueta: rol }));

type CamposNuevo = z.input<typeof crearUsuarioInternoSchema>;
type CamposEdicion = z.input<typeof actualizarUsuarioSchema>;

const NUEVO: CamposNuevo = { nombre: '', correo: '', contrasena: '', rol: 'Operador' };

function Botones({ enviando, texto }: { enviando: boolean; texto: string }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <DialogClose asChild>
        <Button type="button" variant="ghost">
          Cancelar
        </Button>
      </DialogClose>
      <Button type="submit" disabled={enviando}>
        {texto}
      </Button>
    </div>
  );
}

function DialogoDeUsuario({
  titulo,
  descripcion,
  disparador,
  abierto,
  alCambiarAbierto,
  children,
}: {
  titulo: string;
  descripcion: string;
  disparador: ReactNode;
  abierto: boolean;
  alCambiarAbierto: (abierto: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={abierto} onOpenChange={alCambiarAbierto}>
      <DialogTrigger asChild>{disparador}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle className="display-titulo-3">{titulo}</DialogTitle>
        <DialogDescription className="texto-pequeno">{descripcion}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/**
 * M10-H01 (N-15): el Admin crea un Operador o un Administrador con una contraseña inicial, con el esquema de
 * `@shopcart/shared` (FE-03). Los Clientes solo se registran.
 */
export function DialogoNuevoUsuario() {
  const [abierto, setAbierto] = useState(false);
  const formulario = useFormularioApi({
    esquema: crearUsuarioInternoSchema,
    mutacion: useCrearUsuario(),
    valoresIniciales: NUEVO,
    campoPorCodigo: { CORREO_EN_USO: 'correo' },
    alTerminar: () => {
      setAbierto(false);
      formulario.form.reset(NUEVO);
    },
  });

  return (
    <DialogoDeUsuario
      titulo="Nuevo usuario"
      descripcion="Un Operador o un Administrador. Comparte la contraseña inicial por un canal seguro."
      disparador={<Button>Nuevo usuario</Button>}
      abierto={abierto}
      alCambiarAbierto={setAbierto}
    >
      <Form {...formulario.form}>
        <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
          <AvisoFormulario error={formulario.errorGeneral} />
          <CampoFormulario nombre="nombre" etiqueta="Nombre" maxLength={100} />
          <CampoFormulario nombre="correo" etiqueta="Correo" type="email" autoComplete="off" />
          <CampoFormulario
            nombre="telefono"
            etiqueta="Teléfono (opcional)"
            type="tel"
            inputMode="numeric"
            vacio="ausente"
          />
          <CampoOpciones<CamposNuevo, RolDeUsuario>
            nombre="rol"
            etiqueta="Rol"
            opciones={opcionesDe(ROLES_INTERNOS)}
          />
          <CampoFormulario
            nombre="contrasena"
            etiqueta="Contraseña inicial"
            type="password"
            autoComplete="new-password"
          />
          <Botones enviando={formulario.enviando} texto="Crear usuario" />
        </form>
      </Form>
    </DialogoDeUsuario>
  );
}

/**
 * M10-H01: el nombre y el rol. Cambiar el rol corta sus sesiones (A-07); el backend no deja cambiar el propio ni
 * quitarle el rol al último Admin (409 con su mensaje en el aviso).
 */
export function DialogoEditarUsuario({ usuario }: { usuario: UsuarioAdmin }) {
  const [abierto, setAbierto] = useState(false);
  const iniciales: CamposEdicion = { nombre: usuario.nombre, rol: usuario.rol };
  const formulario = useFormularioApi({
    esquema: actualizarUsuarioSchema,
    mutacion: useActualizarUsuario(usuario.idUsuario),
    valoresIniciales: iniciales,
    alTerminar: () => {
      setAbierto(false);
    },
  });
  const cambiarAbierto = (siguiente: boolean) => {
    if (siguiente) formulario.form.reset(iniciales);
    setAbierto(siguiente);
  };

  return (
    <DialogoDeUsuario
      titulo={`Editar a ${usuario.nombre}`}
      descripcion={`${usuario.correo}. Si cambias el rol, sus sesiones se cierran.`}
      disparador={
        <Button variant="link" size="sm" aria-label={`Editar a ${usuario.nombre}`}>
          Editar
        </Button>
      }
      abierto={abierto}
      alCambiarAbierto={cambiarAbierto}
    >
      <Form {...formulario.form}>
        <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
          <AvisoFormulario error={formulario.errorGeneral} />
          <CampoFormulario nombre="nombre" etiqueta="Nombre" maxLength={100} />
          <CampoOpciones<CamposEdicion, RolDeUsuario>
            nombre="rol"
            etiqueta="Rol"
            opciones={opcionesDe(ROLES_DE_USUARIO)}
          />
          <Botones enviando={formulario.enviando} texto="Guardar cambios" />
        </form>
      </Form>
    </DialogoDeUsuario>
  );
}
