import { actualizarCategoriaSchema, crearCategoriaSchema } from '@shopcart/shared';
import { useState, type ReactNode } from 'react';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { useFormularioApi } from '../../../shared/hooks/useFormularioApi';
import { Button } from '../../../shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../../../shared/ui/dialog';
import { Form } from '../../../shared/ui/form';
import type { CategoriaAdmin } from '../catalogo.api';
import { useActualizarCategoria, useCrearCategoria } from '../hooks/useCategoriasAdmin';
import { SelectorIlustracion } from './SelectorIlustracion';

interface PropsMarco {
  titulo: string;
  disparador: ReactNode;
  abierto: boolean;
  alCambiar: (abierto: boolean) => void;
  children: ReactNode;
}

function MarcoDialogo({ titulo, disparador, abierto, alCambiar, children }: PropsMarco) {
  return (
    <Dialog open={abierto} onOpenChange={alCambiar}>
      <DialogTrigger asChild>{disparador}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle className="titulo-2">{titulo}</DialogTitle>
        <DialogDescription className="texto-pequeno">
          La ilustración es la prenda que la tienda tiñe con el color de cada variante.
        </DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function Campos({ vacioDescripcion }: { vacioDescripcion: 'ausente' | 'nulo' }) {
  return (
    <>
      <CampoFormulario nombre="nombre" etiqueta="Nombre" maxLength={80} />
      <CampoFormulario
        nombre="descripcion"
        etiqueta="Descripción (opcional)"
        maxLength={300}
        vacio={vacioDescripcion}
      />
      <SelectorIlustracion />
    </>
  );
}

/** M6-H02: una categoría nueva; sin ilustración elegida, la base pone la suya por defecto. */
export function DialogoNuevaCategoria({ disparador }: { disparador: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const formulario = useFormularioApi({
    esquema: crearCategoriaSchema,
    mutacion: useCrearCategoria(),
    valoresIniciales: { nombre: '' },
    alTerminar: () => {
      setAbierto(false);
      formulario.form.reset();
    },
  });
  return (
    <MarcoDialogo
      titulo="Nueva categoría"
      disparador={disparador}
      abierto={abierto}
      alCambiar={setAbierto}
    >
      <Form {...formulario.form}>
        <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
          <AvisoFormulario error={formulario.errorGeneral} />
          <Campos vacioDescripcion="ausente" />
          <Button type="submit" cargando={formulario.enviando} disabled={formulario.enviando}>
            Guardar categoría
          </Button>
        </form>
      </Form>
    </MarcoDialogo>
  );
}

/** M6-H02: editar una categoría; la descripción vacía se quita (PATCH con `null`). */
export function DialogoEditarCategoria({
  categoria,
  disparador,
}: {
  categoria: CategoriaAdmin;
  disparador: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const formulario = useFormularioApi({
    esquema: actualizarCategoriaSchema,
    mutacion: useActualizarCategoria(categoria.idCategoria),
    valoresIniciales: {
      nombre: categoria.nombre,
      descripcion: categoria.descripcion,
      ilustracion: categoria.ilustracion,
    },
    alTerminar: () => {
      setAbierto(false);
    },
  });
  return (
    <MarcoDialogo
      titulo="Editar categoría"
      disparador={disparador}
      abierto={abierto}
      alCambiar={setAbierto}
    >
      <Form {...formulario.form}>
        <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
          <AvisoFormulario error={formulario.errorGeneral} />
          <Campos vacioDescripcion="nulo" />
          <Button type="submit" cargando={formulario.enviando} disabled={formulario.enviando}>
            Guardar cambios
          </Button>
        </form>
      </Form>
    </MarcoDialogo>
  );
}
