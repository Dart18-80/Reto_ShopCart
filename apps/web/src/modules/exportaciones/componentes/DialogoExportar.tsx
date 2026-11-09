import {
  FORMATOS_EXPORTACION,
  solicitarExportacionSchema,
  type FormatoExportacion,
  type ReporteDashboard,
  type SolicitarExportacion,
} from '@shopcart/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoOpciones } from '../../../shared/componentes/CampoOpciones';
import { EstadoVista } from '../../../shared/componentes/EstadoVista';
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
import { NOMBRE_DEL_REPORTE } from '../descripciones';
import { useExportacion, useSolicitarExportacion } from '../hooks/useExportaciones';
import { DescargarExportacion, TextoEstadoExportacion } from './EstadoExportacion';
import { RUTAS } from '../../../shared/rutas';

const NOMBRE_DEL_FORMATO: Record<FormatoExportacion, string> = { xlsx: 'Excel', pdf: 'PDF' };
const OPCIONES_DE_FORMATO = FORMATOS_EXPORTACION.map((formato) => ({
  valor: formato,
  etiqueta: NOMBRE_DEL_FORMATO[formato],
}));

/** Sigue la exportación pedida hasta que termina, con la cadencia del backend (Retry-After). */
function SeguimientoExportacion({ idExportacion }: { idExportacion: number }) {
  const seguimiento = useExportacion(idExportacion);
  return (
    <div role="status" className="bg-muted flex flex-col gap-3 rounded-md p-4">
      <EstadoVista consulta={seguimiento}>
        {({ exportacion }) => (
          <div className="texto-pequeno flex flex-wrap items-center justify-between gap-3">
            <TextoEstadoExportacion exportacion={exportacion} />
            <DescargarExportacion exportacion={exportacion} />
          </div>
        )}
      </EstadoVista>
      <Link to={RUTAS.exportaciones} className="texto-pequeno text-primary underline">
        Ver mis exportaciones
      </Link>
    </div>
  );
}

interface PropsDialogoExportar {
  reporte: ReporteDashboard;
  /** Los mismos filtros que se ven en pantalla (el rango y, en las ventas, la agrupación). */
  filtros: SolicitarExportacion['filtros'];
}

/**
 * M11-H03: «Exportar» un reporte del dashboard a Excel o PDF. La exportación es asíncrona: se pide, se sigue aquí
 * hasta que el archivo está listo y también queda en «Mis exportaciones».
 */
export function DialogoExportar({ reporte, filtros }: PropsDialogoExportar) {
  const titulo = NOMBRE_DEL_REPORTE[reporte];
  const [abierto, setAbierto] = useState(false);
  const [idExportacion, setIdExportacion] = useState<number | null>(null);
  const iniciales: SolicitarExportacion = { formato: 'xlsx', filtros };
  const formulario = useFormularioApi({
    esquema: solicitarExportacionSchema,
    mutacion: useSolicitarExportacion(reporte),
    valoresIniciales: iniciales,
    alTerminar: ({ exportacion }) => {
      setIdExportacion(exportacion.idExportacion);
    },
  });
  // Cada vez que se abre parte de los filtros de ese momento y sin la exportación anterior.
  const cambiarAbierto = (siguiente: boolean) => {
    if (siguiente) {
      formulario.reiniciar(iniciales);
      setIdExportacion(null);
    }
    setAbierto(siguiente);
  };

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Exportar ${titulo}`}>
          Exportar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle className="display-titulo-3">Exportar {titulo.toLowerCase()}</DialogTitle>
        <DialogDescription className="texto-pequeno">
          Con los mismos filtros que ves en el dashboard. El archivo se genera en segundo plano.
        </DialogDescription>
        <Form {...formulario.form}>
          <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
            <AvisoFormulario error={formulario.errorGeneral} />
            <CampoOpciones<SolicitarExportacion, FormatoExportacion>
              nombre="formato"
              etiqueta="Formato"
              opciones={OPCIONES_DE_FORMATO}
            />
            {idExportacion !== null && <SeguimientoExportacion idExportacion={idExportacion} />}
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cerrar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={formulario.enviando}>
                Exportar
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
