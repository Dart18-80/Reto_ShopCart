import type { Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { Decimal } from 'decimal.js';
import ExcelJS from 'exceljs';
import pdfmake from 'pdfmake';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces.js';
import { aHoraDeGuatemala, fechaHoraDeGuatemala, leyendaDatosAl } from './exportaciones.formato.js';
import type { Celda, Formato, TablaReporte } from './exportaciones.types.js';

/** E7-H05: escribe una tabla en un formato de archivo, por streaming. */
export interface Generador {
  tipoContenido: string;
  /** Un reporte con más filas es un error definitivo: nunca se trunca en silencio. */
  limiteFilas: number;
  /** Escribe el archivo en `destino` y lo cierra; resuelve cuando terminó. */
  escribir(tabla: TablaReporte, datosAl: Date, destino: Writable): Promise<void>;
}

// Excel resiste muchas filas por streaming; un PDF de miles de páginas no le sirve a nadie.
export const LIMITE_FILAS_EXCEL = 50_000;
export const LIMITE_FILAS_PDF = 2_000;

const FORMATO_MONTO = '#,##0.00';
const FORMATO_FECHA = 'dd/mm/yyyy hh:mm';
// OWASP (CSV/formula injection): un texto que Excel podría interpretar como fórmula va con un apóstrofo delante.
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;

export const sinFormula = (texto: string): string =>
  INICIO_DE_FORMULA.test(texto) ? `'${texto}` : texto;

interface CeldaExcel {
  valor: ExcelJS.CellValue;
  formato?: string;
}

function celdaExcel(celda: Celda): CeldaExcel {
  // A-21: el dinero viaja como Decimal; el archivo necesita un número para que Excel lo sume y lo muestre con
  // dos decimales. Es la frontera del sistema, como montoParaSql.
  if (celda instanceof Decimal)
    return { valor: celda.toDecimalPlaces(2).toNumber(), formato: FORMATO_MONTO };
  // Excel no tiene zona horaria: la celda lleva la hora de Guatemala.
  if (celda instanceof Date) return { valor: aHoraDeGuatemala(celda), formato: FORMATO_FECHA };
  if (typeof celda === 'string') return { valor: sinFormula(celda) };
  return { valor: celda };
}

const generadorExcel: Generador = {
  tipoContenido: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  limiteFilas: LIMITE_FILAS_EXCEL,

  async escribir(tabla, datosAl, destino) {
    const libro = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: destino, useStyles: true });
    const hoja = libro.addWorksheet(tabla.titulo.slice(0, 31));
    hoja.addRow([sinFormula(tabla.titulo)]).font = { bold: true, size: 14 };
    hoja.addRow([sinFormula(tabla.descripcion)]);
    hoja.addRow([leyendaDatosAl(datosAl)]);
    hoja.addRow([]);
    hoja.addRow(tabla.columnas.map(sinFormula)).font = { bold: true };
    const agregarFila = (fila: Celda[], negrita = false) => {
      const celdas = fila.map(celdaExcel);
      const filaExcel = hoja.addRow(celdas.map((c) => c.valor));
      celdas.forEach((c, i) => {
        if (c.formato !== undefined) filaExcel.getCell(i + 1).numFmt = c.formato;
      });
      if (negrita) filaExcel.font = { bold: true };
      filaExcel.commit();
    };
    for (const fila of tabla.filas) agregarFila(fila);
    if (tabla.totales !== null) agregarFila(tabla.totales, true);
    hoja.commit();
    await libro.commit();
  },
};

/** Una celda del PDF: los montos con dos decimales y separador de miles, las fechas en hora de Guatemala. */
export function textoPdf(celda: Celda): string {
  if (celda instanceof Decimal) {
    const [entero = '0', decimales = '00'] = celda.toFixed(2).split('.');
    return `${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decimales}`;
  }
  if (celda instanceof Date) return fechaHoraDeGuatemala(celda);
  return celda === null ? '' : String(celda);
}

const alinear = (celda: Celda): 'right' | 'left' =>
  celda instanceof Decimal || typeof celda === 'number' ? 'right' : 'left';

/** La definición del documento (separada para probar su contenido sin leer el PDF binario). */
export function definicionPdf(tabla: TablaReporte, datosAl: Date): TDocumentDefinitions {
  const fila = (celdas: Celda[], negrita = false): Content[] =>
    celdas.map((c) => ({ text: textoPdf(c), alignment: alinear(c), bold: negrita }));
  return {
    pageSize: 'LETTER',
    pageOrientation: tabla.columnas.length > 4 ? 'landscape' : 'portrait',
    defaultStyle: { font: 'Helvetica', fontSize: 9 },
    content: [
      { text: tabla.titulo, fontSize: 14, bold: true },
      { text: tabla.descripcion },
      { text: leyendaDatosAl(datosAl), margin: [0, 0, 0, 8] },
      {
        table: {
          headerRows: 1,
          body: [
            tabla.columnas.map((c) => ({ text: c, bold: true })),
            ...tabla.filas.map((f) => fila(f)),
            ...(tabla.totales === null ? [] : [fila(tabla.totales, true)]),
          ],
        },
      },
    ],
  };
}

// Las fuentes estándar del PDF: no hacen falta archivos de fuente en la imagen.
pdfmake.setFonts({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});

const generadorPdf: Generador = {
  tipoContenido: 'application/pdf',
  limiteFilas: LIMITE_FILAS_PDF,

  async escribir(tabla, datosAl, destino) {
    const documento = await pdfmake.createPdf(definicionPdf(tabla, datosAl)).getStream();
    documento.pipe(destino);
    documento.end();
    await finished(destino);
  },
};

/** El formato elige su generador (abierto/cerrado: un formato nuevo es una entrada más). */
export const GENERADORES: Record<Formato, Generador> = {
  xlsx: generadorExcel,
  pdf: generadorPdf,
};
