import { crearAtributoSchema, crearValorAtributoSchema } from '@shopcart/shared';
import { useId, useState } from 'react';
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
import type { Atributo } from '../catalogo.api';
import { useCrearAtributo, useCrearValorAtributo } from '../hooks/useAtributos';

/** M6-H02: un atributo (Talla, Color) con sus valores en el orden del backend y el formulario para uno nuevo. */
export function TarjetaAtributo({ atributo }: { atributo: Atributo }) {
  const idTitulo = useId();
  const formulario = useFormularioApi({
    esquema: crearValorAtributoSchema,
    mutacion: useCrearValorAtributo(atributo.idAtributo),
    valoresIniciales: { valor: '' },
    alTerminar: () => {
      formulario.form.reset();
    },
  });
  return (
    <section
      aria-labelledby={idTitulo}
      className="bg-card flex flex-col gap-3 rounded-tarjeta border p-4"
    >
      <h3 id={idTitulo} className="texto-base-fuerte">
        {atributo.nombre}
      </h3>
      <ol className="flex flex-wrap gap-2">
        {atributo.valores.map((valor) => (
          <li key={valor.idValorAtributo} className="bg-muted texto-pequeno rounded-full px-3 py-1">
            {valor.valor}
          </li>
        ))}
      </ol>
      <Form {...formulario.form}>
        <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-2">
          <AvisoFormulario error={formulario.errorGeneral} />
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <CampoFormulario nombre="valor" etiqueta="Valor nuevo" maxLength={50} />
            </div>
            <Button
              type="submit"
              variant="outline"
              cargando={formulario.enviando}
              disabled={formulario.enviando}
            >
              Agregar
            </Button>
          </div>
        </form>
      </Form>
    </section>
  );
}

/** M6-H02: un atributo nuevo; los valores se agregan después, en su tarjeta. */
export function DialogoNuevoAtributo() {
  const [abierto, setAbierto] = useState(false);
  const formulario = useFormularioApi({
    esquema: crearAtributoSchema,
    mutacion: useCrearAtributo(),
    valoresIniciales: { nombre: '' },
    alTerminar: () => {
      setAbierto(false);
      formulario.form.reset();
    },
  });
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline">Nuevo atributo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="titulo-2">Nuevo atributo</DialogTitle>
        <DialogDescription className="texto-pequeno">
          Talla, Color o Material: todas las variantes de un producto usan los mismos atributos.
        </DialogDescription>
        <Form {...formulario.form}>
          <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
            <AvisoFormulario error={formulario.errorGeneral} />
            <CampoFormulario nombre="nombre" etiqueta="Nombre" maxLength={50} />
            <Button type="submit" cargando={formulario.enviando} disabled={formulario.enviando}>
              Guardar atributo
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
