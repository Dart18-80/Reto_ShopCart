import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Aviso } from '../../../shared/componentes/Aviso';
import { EstadoVista } from '../../../shared/componentes/EstadoVista';
import { Button } from '../../../shared/ui/button';
import { useCarrito, type Carrito } from '../../carrito';
import { useDirecciones, type Direccion } from '../../direcciones';
import { useMetodosEnvio, type MetodosEnvio } from '../../envios';
import { useIniciarSesionPago } from '../hooks/useIniciarSesionPago';
import { AvisoInicioPago } from './AvisoInicioPago';
import { CostoEnvio } from './CostoEnvio';
import { ResumenPedido } from './ResumenPedido';
import { SeleccionDireccion } from './SeleccionDireccion';
import { SeleccionEnvio } from './SeleccionEnvio';

export const RUTA_PAGO = '/checkout/pago';
const RUTA_CARRITO = '/carrito';

const CARRITO_VACIO = {
  titulo: 'Tu carrito está vacío',
  descripcion: 'Agrega productos antes de pagar.',
  accion: (
    <Button asChild variant="outline" size="sm">
      <Link to="/">Ver el catálogo</Link>
    </Button>
  ),
};
const SIN_METODOS = {
  titulo: 'No hay métodos de envío disponibles',
  descripcion: 'Intenta más tarde.',
};

const sinLineas = (carrito: Carrito) => carrito.lineas.length === 0;
const sinMetodos = (envios: MetodosEnvio) => envios.metodos.length === 0;
// Sin direcciones, el paso muestra el formulario de la primera en lugar de un mensaje de vacío.
const nuncaVacia = () => false;
const SIN_USO = { titulo: '' };

const direccionInicial = (direcciones: Direccion[] | undefined) =>
  (direcciones?.find((direccion) => direccion.esPredeterminada) ?? direcciones?.[0])?.idDireccion;

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="display-titulo-3">{titulo}</h2>
      {children}
    </section>
  );
}

interface PropsCuerpo {
  carrito: Carrito;
  envios: MetodosEnvio;
}

function CuerpoDelPaso({ carrito, envios }: PropsCuerpo) {
  const navigate = useNavigate();
  const direcciones = useDirecciones();
  const iniciar = useIniciarSesionPago();
  const [idDireccionElegida, setIdDireccionElegida] = useState<number>();
  const [idMetodoElegido, setIdMetodoElegido] = useState<number>();

  // Una elegida que ya no está en la lista (se eliminó en otra pestaña) cae a la inicial.
  const elegida = direcciones.data?.find((d) => d.idDireccion === idDireccionElegida);
  const idDireccion = elegida?.idDireccion ?? direccionInicial(direcciones.data);
  // sinMetodos ya descartó la lista vacía.
  const metodo =
    envios.metodos.find((m) => m.idMetodoEnvio === idMetodoElegido) ?? envios.metodos[0];
  if (!metodo) return null;

  const continuar = () => {
    if (idDireccion === undefined) return;
    iniciar.mutate(
      { idDireccion, idMetodoEnvio: metodo.idMetodoEnvio },
      {
        onSuccess: () => void navigate(RUTA_PAGO),
        // N-06: con el carrito vacío no hay nada que pagar; el carrito lo explica.
        onError: (error) => {
          if (error.codigo === 'CARRITO_VACIO') void navigate(RUTA_CARRITO);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-12">
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <Seccion titulo="Dirección de entrega">
          <EstadoVista consulta={direcciones} vacio={SIN_USO} esVacio={nuncaVacia}>
            {(lista) => (
              <SeleccionDireccion
                direcciones={lista}
                elegida={idDireccion}
                alElegir={setIdDireccionElegida}
              />
            )}
          </EstadoVista>
        </Seccion>
        <Seccion titulo="Método de envío">
          <SeleccionEnvio metodos={envios.metodos} elegido={metodo} alElegir={setIdMetodoElegido} />
        </Seccion>
      </div>
      <div className="md:w-105 md:shrink-0">
        <ResumenPedido
          lineas={carrito.lineas.map((linea) => ({ ...linea, clave: linea.idLinea }))}
          subtotal={carrito.resumen.subtotal}
          descuento={carrito.resumen.descuento}
          codigoCupon={carrito.resumen.cupon?.codigo ?? null}
          envio={<CostoEnvio metodo={metodo} />}
          total={metodo.totalConEnvio}
        >
          <Aviso tipo="info">
            {`Al continuar apartamos tus productos por ${String(envios.minutosReserva)} minutos mientras pagas.`}
          </Aviso>
          <AvisoInicioPago error={iniciar.error} />
          <Button
            type="button"
            disabled={idDireccion === undefined || iniciar.isPending}
            onClick={continuar}
            className="control-boton h-auto w-full px-6 py-3"
          >
            Continuar al pago
          </Button>
        </ResumenPedido>
      </div>
    </div>
  );
}

/**
 * M4-H02 (Figma 40:864): la dirección y el método de envío. El total con envío de cada método lo calcula el
 * backend (`totalConEnvio`): el navegador no suma montos (FE-10).
 */
export function PasoDireccionYEnvio() {
  const carrito = useCarrito();
  const envios = useMetodosEnvio();
  return (
    <EstadoVista consulta={carrito} vacio={CARRITO_VACIO} esVacio={sinLineas}>
      {(delCarrito) => (
        <EstadoVista consulta={envios} vacio={SIN_METODOS} esVacio={sinMetodos}>
          {(delEnvio) => <CuerpoDelPaso carrito={delCarrito} envios={delEnvio} />}
        </EstadoVista>
      )}
    </EstadoVista>
  );
}
