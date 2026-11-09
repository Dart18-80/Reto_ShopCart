import { actualizarProductoSchema } from '@shopcart/shared';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { CampoSeleccion } from '../../../shared/componentes/CampoSeleccion';
import { useFormularioApi } from '../../../shared/hooks/useFormularioApi';
import { Form } from '../../../shared/ui/form';
import type { CategoriaAdmin, ProductoAdmin } from '../catalogo.api';
import { useActualizarProducto } from '../hooks/useProductoAdmin';

/** El formulario se envía con «Guardar cambios» del encabezado de la página (Figma 48:1309). */
export const ID_FORMULARIO_PRODUCTO = 'datos-del-producto';

interface PropsDatosProducto {
  producto: ProductoAdmin;
  categorias: CategoriaAdmin[];
}

/** M6-H04: nombre, categoría y descripción (PATCH; la descripción vacía se quita con `null`). */
export function DatosProducto({ producto, categorias }: PropsDatosProducto) {
  const formulario = useFormularioApi({
    esquema: actualizarProductoSchema,
    mutacion: useActualizarProducto(producto.idProducto),
    valoresIniciales: {
      nombre: producto.nombre,
      idCategoria: producto.idCategoria,
      descripcion: producto.descripcion,
    },
  });
  // N-14: se ofrecen las activas y, si la del producto se desactivó, también la suya.
  const opciones = categorias
    .filter((c) => c.activo || c.idCategoria === producto.idCategoria)
    .map((c) => ({ valor: c.idCategoria, etiqueta: c.nombre }));

  return (
    <section
      aria-labelledby="titulo-datos"
      className="bg-card flex flex-col gap-4 rounded-tarjeta border p-6"
    >
      <h2 id="titulo-datos" className="titulo-2">
        Datos del producto
      </h2>
      <Form {...formulario.form}>
        <form
          id={ID_FORMULARIO_PRODUCTO}
          onSubmit={formulario.enviar}
          noValidate
          className="flex flex-col gap-5"
        >
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
            etiqueta="Descripción"
            descripcion="Opcional. Hasta 2,000 caracteres."
            maxLength={2000}
            vacio="nulo"
          />
        </form>
      </Form>
    </section>
  );
}
