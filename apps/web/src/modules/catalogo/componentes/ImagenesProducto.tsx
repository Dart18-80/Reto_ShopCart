import { imagenProductoSchema, type ImagenProducto } from '@shopcart/shared';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { Aviso } from '../../../shared/componentes/Aviso';
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
import type { ProductoAdmin } from '../catalogo.api';
import { useGuardarImagenes } from '../hooks/useProductoAdmin';

type Imagen = ProductoAdmin['imagenes'][number];

const aCuerpo = ({ url, textoAlternativo, orden, esPrincipal }: Imagen): ImagenProducto => ({
  url,
  textoAlternativo,
  orden,
  esPrincipal,
});

// N-19: la nueva va al final; si es la primera, es la principal (el backend exige exactamente una).
const siguienteOrden = (imagenes: Imagen[]) =>
  imagenes.reduce((mayor, imagen) => Math.max(mayor, imagen.orden), 0) + 1;

function DialogoImagen({
  imagenes,
  guardar,
}: {
  imagenes: Imagen[];
  guardar: ReturnType<typeof useGuardarImagenes>;
}) {
  const [abierto, setAbierto] = useState(false);
  const primera = imagenes.length === 0;
  const mutacion = {
    isPending: guardar.isPending,
    mutateAsync: (datos: ImagenProducto) => {
      // El orden y la principal salen de la lista vigente al guardar, no de cuando se abrió el formulario.
      const nueva = {
        ...datos,
        orden: siguienteOrden(imagenes),
        esPrincipal: imagenes.length === 0 || datos.esPrincipal,
      };
      const conservadas = imagenes.map(aCuerpo).map((imagen) => ({
        ...imagen,
        esPrincipal: nueva.esPrincipal ? false : imagen.esPrincipal,
      }));
      return guardar.mutateAsync({ imagenes: [...conservadas, nueva] });
    },
  };
  const formulario = useFormularioApi({
    esquema: imagenProductoSchema,
    mutacion,
    valoresIniciales: {
      url: '',
      textoAlternativo: '',
      orden: siguienteOrden(imagenes),
      esPrincipal: primera,
    },
    alTerminar: () => {
      setAbierto(false);
      formulario.form.reset();
    },
  });

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline">Agregar imagen</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="display-titulo-3">Agregar imagen</DialogTitle>
        <DialogDescription className="texto-pequeno">
          Una URL absoluta o una ruta servida por la tienda (/static/productos/…).
        </DialogDescription>
        <Form {...formulario.form}>
          <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
            <AvisoFormulario error={formulario.errorGeneral} />
            <CampoFormulario nombre="url" etiqueta="URL" maxLength={500} />
            <CampoFormulario
              nombre="textoAlternativo"
              etiqueta="Texto alternativo"
              maxLength={150}
            />
            <Controller
              control={formulario.form.control}
              name="esPrincipal"
              render={({ field }) => (
                <label className="texto-base flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={field.value}
                    disabled={primera}
                    onChange={(evento) => {
                      field.onChange(evento.target.checked);
                    }}
                    className="accent-primary size-4"
                  />
                  Imagen principal
                </label>
              )}
            />
            <Button type="submit" disabled={formulario.enviando}>
              Guardar imagen
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * M6-H04 (Figma 48:1309): las imágenes del producto. Se guarda la lista completa (PUT); en la tienda la
 * ilustración de la categoría va primero y las imágenes son miniaturas (FE-15).
 */
export function ImagenesProducto({ producto }: { producto: ProductoAdmin }) {
  const guardar = useGuardarImagenes(producto.idProducto);
  const { imagenes } = producto;
  const reemplazar = (lista: ImagenProducto[]) => {
    guardar.mutate({ imagenes: lista });
  };
  const quitar = (imagen: Imagen) => {
    const restantes = imagenes.filter((i) => i.idImagenProducto !== imagen.idImagenProducto);
    // Si se quita la principal, la siguiente pasa a serlo.
    reemplazar(
      restantes.map(aCuerpo).map((i, indice) => ({
        ...i,
        esPrincipal: imagen.esPrincipal ? indice === 0 : i.esPrincipal,
      })),
    );
  };
  const hacerPrincipal = (imagen: Imagen) => {
    reemplazar(
      imagenes.map(aCuerpo).map((i, indice) => ({
        ...i,
        esPrincipal: imagenes[indice]?.idImagenProducto === imagen.idImagenProducto,
      })),
    );
  };

  return (
    <section
      aria-labelledby="titulo-imagenes"
      className="bg-card flex flex-col gap-4 rounded-xl border p-6"
    >
      <h2 id="titulo-imagenes" className="display-titulo-3">
        Imágenes
      </h2>
      {guardar.error && <Aviso tipo="error">{guardar.error.mensaje}</Aviso>}
      <ul className="flex flex-col gap-3">
        {imagenes.map((imagen) => (
          <li key={imagen.idImagenProducto} className="flex items-center gap-3">
            <img
              src={imagen.url}
              alt={imagen.textoAlternativo}
              className="bg-muted size-12 shrink-0 rounded-md object-contain"
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="texto-pequeno-fuerte truncate">{imagen.url}</span>
              <span className="texto-nota text-muted-foreground truncate">
                {`${imagen.esPrincipal ? 'Principal. ' : ''}Texto alternativo: ${imagen.textoAlternativo}`}
              </span>
            </div>
            {!imagen.esPrincipal && (
              <Button
                variant="ghost"
                size="sm"
                disabled={guardar.isPending}
                onClick={() => {
                  hacerPrincipal(imagen);
                }}
              >
                Principal
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              disabled={guardar.isPending}
              aria-label={`Quitar ${imagen.textoAlternativo}`}
              onClick={() => {
                quitar(imagen);
              }}
            >
              Quitar
            </Button>
          </li>
        ))}
      </ul>
      <div>
        <DialogoImagen imagenes={imagenes} guardar={guardar} />
      </div>
      <p className="texto-nota text-muted-foreground">
        En la tienda se muestra primero la ilustración de la categoría; las imágenes aparecen como
        miniaturas.
      </p>
    </section>
  );
}
