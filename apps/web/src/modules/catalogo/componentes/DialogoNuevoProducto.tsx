import { crearProductoSchema } from '@shopcart/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { CampoSeleccion } from '../../../shared/componentes/CampoSeleccion';
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
import { useCrearProducto } from '../hooks/useProductosAdmin';

/**
 * M6-H03: un producto nuevo con nombre, categoría y descripción (el esquema de `@shopcart/shared`); al crearse va
 * a su editor, donde se agregan imágenes y variantes. Solo se ofrecen categorías activas (N-14).
 */
export function DialogoNuevoProducto({ categorias }: { categorias: CategoriaAdmin[] }) {
  const [abierto, setAbierto] = useState(false);
  const navigate = useNavigate();
  const formulario = useFormularioApi({
    esquema: crearProductoSchema,
    mutacion: useCrearProducto(),
    valoresIniciales: { nombre: '', activo: true },
    alTerminar: (producto) => {
      void navigate(`/backoffice/catalogo/productos/${String(producto.idProducto)}`);
    },
  });
  const opciones = categorias
    .filter((categoria) => categoria.activo)
    .map((categoria) => ({ valor: categoria.idCategoria, etiqueta: categoria.nombre }));

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>Nuevo producto</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle className="display-titulo-3">Nuevo producto</DialogTitle>
        <DialogDescription className="texto-pequeno">
          Después agregas sus imágenes, sus variantes y sus precios.
        </DialogDescription>
        <Form {...formulario.form}>
          <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
            <AvisoFormulario error={formulario.errorGeneral} />
            <CampoFormulario nombre="nombre" etiqueta="Nombre" maxLength={150} />
            <CampoSeleccion
              nombre="idCategoria"
              etiqueta="Categoría"
              sinElegir="Elige una categoría"
              opciones={opciones}
            />
            <CampoFormulario
              nombre="descripcion"
              etiqueta="Descripción (opcional)"
              maxLength={2000}
              vacio="ausente"
            />
            <Button type="submit" disabled={formulario.enviando}>
              Crear producto
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
