import { actualizarConfiguracionSchema, RANGOS_CONFIGURACION } from '@shopcart/shared';
import { useState } from 'react';
import { z } from 'zod';
import { Aviso } from '../../../shared/componentes/Aviso';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { EstadoVista } from '../../../shared/componentes/EstadoVista';
import { formatearFechaHora } from '../../../shared/formato/fecha';
import { enteroDelCampo } from '../../../shared/formularios';
import { useFormularioApi } from '../../../shared/hooks/useFormularioApi';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { Button } from '../../../shared/ui/button';
import { Form } from '../../../shared/ui/form';
import type { Configuracion } from '../configuracion.api';
import { useActualizarConfiguracion, useConfiguracion } from '../hooks/useConfiguracion';

type Entero = keyof typeof RANGOS_CONFIGURACION;

// Cada parámetro con su nombre para la persona y para qué sirve; el rango sale de A-14 (RANGOS_CONFIGURACION).
const PARAMETROS: { campo: Entero; etiqueta: string; para: string }[] = [
  {
    campo: 'minutosReserva',
    etiqueta: 'Minutos de reserva al pagar',
    para: 'Lo que dura apartado un carrito mientras se paga.',
  },
  {
    campo: 'maxIntentosPagoRechazados',
    etiqueta: 'Intentos de pago rechazados',
    para: 'Cuántos rechazos admite una sesión de pago.',
  },
  {
    campo: 'diasGarantiaPrecio',
    etiqueta: 'Días de garantía de precio',
    para: 'Cuánto respeta el carrito un precio que subió (N-02).',
  },
  {
    campo: 'umbralUltimasUnidades',
    etiqueta: 'Aviso de últimas unidades',
    para: 'Desde cuántas unidades la tienda dice «¡Últimas!».',
  },
  {
    campo: 'maxLineasCarrito',
    etiqueta: 'Productos distintos por carrito',
    para: 'El máximo de líneas de un carrito.',
  },
  {
    campo: 'diasExpiracionCarritoInvitado',
    etiqueta: 'Días del carrito de invitado',
    para: 'Cuánto se guarda el carrito de quien no ingresó.',
  },
  {
    campo: 'horasCarritoAbandonado',
    etiqueta: 'Horas para un carrito abandonado',
    para: 'Sin cambios en ese tiempo, cuenta en el dashboard.',
  },
  {
    campo: 'diasPlazoDevolucion',
    etiqueta: 'Días para devolver',
    para: 'Desde que el pedido se entregó (N-10).',
  },
];

const rangoDe = (campo: Entero) => {
  const [minimo, maximo] = RANGOS_CONFIGURACION[campo];
  return `Entre ${String(minimo)} y ${String(maximo)}.`;
};

// Los números se escriben como texto y el envío gratis vacío es «sin envío gratis» (null); las reglas son las del
// esquema compartido (FE-03).
const formularioConfiguracionSchema = z
  .object({
    minutosReserva: enteroDelCampo,
    maxIntentosPagoRechazados: enteroDelCampo,
    diasGarantiaPrecio: enteroDelCampo,
    umbralUltimasUnidades: enteroDelCampo,
    maxLineasCarrito: enteroDelCampo,
    diasExpiracionCarritoInvitado: enteroDelCampo,
    horasCarritoAbandonado: enteroDelCampo,
    diasPlazoDevolucion: enteroDelCampo,
    montoEnvioGratis: z.string().trim(),
  })
  .transform(({ montoEnvioGratis, ...enteros }): z.input<typeof actualizarConfiguracionSchema> => ({
    ...enteros,
    montoEnvioGratis: montoEnvioGratis === '' ? null : montoEnvioGratis,
  }))
  .pipe(actualizarConfiguracionSchema);

type CamposConfiguracion = z.input<typeof formularioConfiguracionSchema>;

const camposDe = (c: Configuracion): CamposConfiguracion => ({
  minutosReserva: String(c.minutosReserva),
  maxIntentosPagoRechazados: String(c.maxIntentosPagoRechazados),
  diasGarantiaPrecio: String(c.diasGarantiaPrecio),
  umbralUltimasUnidades: String(c.umbralUltimasUnidades),
  maxLineasCarrito: String(c.maxLineasCarrito),
  diasExpiracionCarritoInvitado: String(c.diasExpiracionCarritoInvitado),
  horasCarritoAbandonado: String(c.horasCarritoAbandonado),
  diasPlazoDevolucion: String(c.diasPlazoDevolucion),
  montoEnvioGratis: c.montoEnvioGratis ?? '',
});

function FormularioConfiguracion({ configuracion }: { configuracion: Configuracion }) {
  const [guardado, setGuardado] = useState(false);
  const formulario = useFormularioApi({
    esquema: formularioConfiguracionSchema,
    mutacion: useActualizarConfiguracion(),
    valoresIniciales: camposDe(configuracion),
    alTerminar: (nueva) => {
      formulario.form.reset(camposDe(nueva));
      setGuardado(true);
    },
  });

  return (
    <Form {...formulario.form}>
      <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-6">
        <AvisoFormulario error={formulario.errorGeneral} />
        {/* Hasta que se vuelva a editar: entonces lo que se ve ya no es lo guardado. */}
        {guardado && !formulario.form.formState.isDirty && (
          <Aviso tipo="exito">Guardamos la configuración.</Aviso>
        )}
        <div className="bg-card grid gap-5 rounded-tarjeta border p-6 md:grid-cols-2">
          {PARAMETROS.map(({ campo, etiqueta, para }) => (
            <CampoFormulario
              key={campo}
              nombre={campo}
              etiqueta={etiqueta}
              inputMode="numeric"
              descripcion={`${para} ${rangoDe(campo)}`}
            />
          ))}
          <CampoFormulario
            nombre="montoEnvioGratis"
            etiqueta="Envío gratis desde"
            inputMode="decimal"
            placeholder="Sin envío gratis"
            descripcion="En quetzales, sobre el subtotal con el cupón (N-04). Vacío: sin envío gratis."
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="texto-nota text-muted-foreground">
            {`Última actualización: ${formatearFechaHora(configuracion.fechaActualizacion)}.`}
          </p>
          <Button type="submit" cargando={formulario.enviando} disabled={formulario.enviando}>
            Guardar configuración
          </Button>
        </div>
      </form>
    </Form>
  );
}

const NUNCA_VACIA = () => false;

/** M9-H02: `/backoffice/configuracion`, solo Admin. Los parámetros del sistema (A-14, ParametroSistema). */
export function ConfiguracionPagina() {
  useTituloPagina('Configuración');
  const configuracion = useConfiguracion();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="titulo-1">Configuración</h1>
        <p className="texto-base text-muted-foreground">
          Los parámetros con que trabaja la tienda. Cada cambio queda en la bitácora.
        </p>
      </div>
      <EstadoVista consulta={configuracion} esVacio={NUNCA_VACIA} vacio={{ titulo: '' }}>
        {(datos) => <FormularioConfiguracion configuracion={datos} />}
      </EstadoVista>
    </div>
  );
}
