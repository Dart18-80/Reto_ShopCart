import { TIPOS_CUPON, type TipoCupon } from '@shopcart/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod';
import type { ErrorApi } from '../../../shared/api';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { CampoOpciones } from '../../../shared/componentes/CampoOpciones';
import { CampoSeleccion } from '../../../shared/componentes/CampoSeleccion';
import { AvisoConsultaFallida } from '../../../shared/componentes/EstadoVista';
import { useFormularioApi, type CampoDelCodigo } from '../../../shared/hooks/useFormularioApi';
import { Button } from '../../../shared/ui/button';
import { CLASE_CASILLA } from '../../../shared/ui/control';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../../../shared/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../../../shared/ui/form';
import { useCategoriasAdmin, type CategoriaAdmin } from '../../catalogo';
import type { Cupon } from '../cupones.api';
import {
  CAMPOS_VACIOS,
  camposDe,
  formularioEditarCuponSchema,
  formularioNuevoCuponSchema,
  type CamposCupon,
  type CamposEdicionCupon,
} from '../formularios';
import { useActualizarCupon, useCrearCupon } from '../hooks/useCupones';

const TIPOS = TIPOS_CUPON.map((valor) => ({
  valor,
  etiqueta: valor === 'Porcentaje' ? 'Porcentaje' : 'Monto fijo',
}));

const DETALLE_VALOR: Record<TipoCupon, string> = {
  Porcentaje: 'El porcentaje, por ejemplo 10 o 12.5.',
  MontoFijo: 'En quetzales.',
};

// detalles.usosComprometidos de 422 CUPON_LIMITE_BAJO_USOS (A-19). Los campos son los que tienen el alta y la
// edición.
const usosSchema = z.object({ usosComprometidos: z.number().int() });

const CAMPO_POR_CODIGO: Partial<Record<string, CampoDelCodigo<CamposEdicionCupon>>> = {
  CUPON_CODIGO_DUPLICADO: 'codigo',
  CUPON_LIMITE_BAJO_USOS: {
    campo: 'limiteUsosTotal',
    mensaje: (error: ErrorApi) => {
      const detalles = usosSchema.safeParse(error.detalles);
      return detalles.success
        ? `${error.mensaje} Ya hay ${String(detalles.data.usosComprometidos)} comprometidos.`
        : error.mensaje;
    },
  },
};

/** El tope solo existe para un porcentaje (CK_Cupon_MontoMaximoDescuento): al pasar a monto fijo se vacía. */
function CamposDelCupon({ categorias }: { categorias: CategoriaAdmin[] }) {
  const { watch, setValue } = useFormContext<CamposCupon>();
  const tipo = watch('tipo');
  useEffect(() => {
    if (tipo === 'MontoFijo') setValue('montoMaximoDescuento', '');
  }, [tipo, setValue]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <CampoFormulario
        nombre="codigo"
        etiqueta="Código"
        maxLength={30}
        autoCapitalize="characters"
      />
      <CampoFormulario nombre="descripcion" etiqueta="Descripción" maxLength={200} />
      <CampoOpciones<CamposCupon, TipoCupon> nombre="tipo" etiqueta="Tipo" opciones={TIPOS} />
      <CampoFormulario
        nombre="valor"
        etiqueta="Valor"
        inputMode="decimal"
        descripcion={DETALLE_VALOR[tipo]}
      />
      {tipo === 'Porcentaje' && (
        <CampoFormulario
          nombre="montoMaximoDescuento"
          etiqueta="Tope de descuento (opcional)"
          inputMode="decimal"
          placeholder="Sin tope"
          descripcion="En quetzales."
        />
      )}
      <CampoFormulario
        nombre="montoMinimoCompra"
        etiqueta="Compra mínima (opcional)"
        inputMode="decimal"
        placeholder="0.00"
        descripcion="En quetzales."
      />
      <CampoSeleccion<CamposCupon>
        nombre="idCategoria"
        etiqueta="Alcance"
        sinElegir="Toda la tienda"
        opciones={categorias.map((c) => ({ valor: c.idCategoria, etiqueta: c.nombre }))}
      />
      <CampoFormulario
        nombre="fechaInicio"
        etiqueta="Vigente desde"
        type="datetime-local"
        descripcion="Hora de Guatemala."
      />
      <CampoFormulario
        nombre="fechaFin"
        etiqueta="Vigente hasta"
        type="datetime-local"
        descripcion="Hora de Guatemala."
      />
      <CampoFormulario nombre="limiteUsosTotal" etiqueta="Límite de usos" inputMode="numeric" />
      <CampoFormulario
        nombre="limiteUsosPorCliente"
        etiqueta="Usos por cliente"
        inputMode="numeric"
      />
    </div>
  );
}

function CampoActivo() {
  const { control } = useFormContext<CamposCupon>();
  return (
    <FormField
      control={control}
      name="activo"
      render={({ field }) => (
        <FormItem className="flex items-center gap-2">
          <FormControl>
            <input
              type="checkbox"
              name={field.name}
              ref={field.ref}
              checked={field.value}
              onChange={(evento) => {
                field.onChange(evento.target.checked);
              }}
              className={CLASE_CASILLA}
            />
          </FormControl>
          <FormLabel className="texto-pequeno">Activo al crearlo</FormLabel>
        </FormItem>
      )}
    />
  );
}

interface PropsDialogo {
  titulo: string;
  descripcion: string;
  disparador: ReactNode;
  abierto: boolean;
  alCambiarAbierto: (abierto: boolean) => void;
  children: ReactNode;
}

function DialogoDeCupon({
  titulo,
  descripcion,
  disparador,
  abierto,
  alCambiarAbierto,
  children,
}: PropsDialogo) {
  return (
    <Dialog open={abierto} onOpenChange={alCambiarAbierto}>
      <DialogTrigger asChild>{disparador}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle className="titulo-2">{titulo}</DialogTitle>
        <DialogDescription className="texto-pequeno">{descripcion}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function Botones({ enviando, texto }: { enviando: boolean; texto: string }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <DialogClose asChild>
        <Button type="button" variant="ghost">
          Cancelar
        </Button>
      </DialogClose>
      <Button type="submit" cargando={enviando} disabled={enviando}>
        {texto}
      </Button>
    </div>
  );
}

/** M9-H01: el alta de un cupón con `crearCuponSchema` de `@shopcart/shared` (FE-03). */
export function DialogoNuevoCupon() {
  const [abierto, setAbierto] = useState(false);
  const categorias = useCategoriasAdmin();
  const formulario = useFormularioApi({
    esquema: formularioNuevoCuponSchema,
    mutacion: useCrearCupon(),
    valoresIniciales: CAMPOS_VACIOS,
    campoPorCodigo: CAMPO_POR_CODIGO,
    alTerminar: () => {
      setAbierto(false);
      formulario.form.reset(CAMPOS_VACIOS);
    },
  });

  return (
    <DialogoDeCupon
      titulo="Nuevo cupón"
      descripcion="El código se guarda en mayúsculas. Los montos van en quetzales."
      disparador={<Button>Nuevo cupón</Button>}
      abierto={abierto}
      alCambiarAbierto={setAbierto}
    >
      <Form {...formulario.form}>
        <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
          <AvisoFormulario error={formulario.errorGeneral} />
          <AvisoConsultaFallida consulta={categorias} titulo="No pudimos cargar las categorías." />
          <CamposDelCupon categorias={categorias.data ?? []} />
          <CampoActivo />
          <Botones enviando={formulario.enviando} texto="Crear cupón" />
        </form>
      </Form>
    </DialogoDeCupon>
  );
}

/**
 * M9-H01: editar con `actualizarCuponSchema`. Qué se puede cambiar de un cupón ya usado lo decide el SP, que
 * responde 409 CUPON_USADO_NO_EDITABLE con su mensaje en el aviso del formulario.
 */
export function DialogoEditarCupon({ cupon }: { cupon: Cupon }) {
  const [abierto, setAbierto] = useState(false);
  const categorias = useCategoriasAdmin();
  const formulario = useFormularioApi({
    esquema: formularioEditarCuponSchema,
    mutacion: useActualizarCupon(cupon.idCupon),
    valoresIniciales: camposDe(cupon),
    campoPorCodigo: CAMPO_POR_CODIGO,
    alTerminar: () => {
      setAbierto(false);
    },
  });
  // Cada vez que se abre parte del cupón guardado (la lista pudo traer una versión más nueva).
  const cambiarAbierto = (siguiente: boolean) => {
    if (siguiente) formulario.reiniciar(camposDe(cupon));
    setAbierto(siguiente);
  };

  return (
    <DialogoDeCupon
      titulo={`Editar ${cupon.codigo}`}
      descripcion="Los montos van en quetzales y la vigencia en hora de Guatemala."
      disparador={
        <Button variant="link" size="sm" aria-label={`Editar ${cupon.codigo}`}>
          Editar
        </Button>
      }
      abierto={abierto}
      alCambiarAbierto={cambiarAbierto}
    >
      <Form {...formulario.form}>
        <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
          <AvisoFormulario error={formulario.errorGeneral} />
          <AvisoConsultaFallida consulta={categorias} titulo="No pudimos cargar las categorías." />
          <CamposDelCupon categorias={categorias.data ?? []} />
          <Botones enviando={formulario.enviando} texto="Guardar cambios" />
        </form>
      </Form>
    </DialogoDeCupon>
  );
}
