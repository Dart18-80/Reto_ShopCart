import { PassThrough, Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { Decimal } from 'decimal.js';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  definicionPdf,
  GENERADORES,
  sinFormula,
  textoPdf,
} from '../../../../src/modules/exportaciones/exportaciones.generadores.js';
import type { TablaReporte } from '../../../../src/modules/exportaciones/exportaciones.types.js';

// 15:30 UTC = 09:30 en Guatemala (UTC−6).
const DATOS_AL = new Date('2026-11-02T15:30:00.000Z');
const TABLA: TablaReporte = {
  titulo: 'Productos más vendidos',
  descripcion: 'Del 2026-10-01 al 2026-10-31',
  columnas: ['Producto', 'Unidades', 'Ventas'],
  filas: [
    ['=HYPERLINK("http://malo.example","clic")', 3, new Decimal('1234.50')],
    ['Tenis', 1, new Decimal('0.10')],
  ],
  totales: ['Total', 4, new Decimal('1234.60')],
};

async function generar(formato: 'xlsx' | 'pdf', tabla = TABLA): Promise<Buffer> {
  const destino = new PassThrough();
  const contenido = buffer(destino);
  await GENERADORES[formato].escribir(tabla, DATOS_AL, destino);
  return contenido;
}

async function leerExcel(archivo: Buffer): Promise<ExcelJS.Worksheet> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.read(Readable.from([archivo]));
  const hoja = libro.worksheets[0];
  if (hoja === undefined) throw new Error('El libro no tiene hojas');
  return hoja;
}

describe('generador de Excel (E7-H05)', () => {
  it('escribe el título, los filtros y "datos al" con la hora de Guatemala', async () => {
    const hoja = await leerExcel(await generar('xlsx'));

    expect(hoja.getCell('A1').value).toBe('Productos más vendidos');
    expect(hoja.getCell('A2').value).toBe('Del 2026-10-01 al 2026-10-31');
    expect(hoja.getCell('A3').value).toBe('Datos al 02/11/2026 09:30 (hora de Guatemala)');
  });

  it('los montos son celdas numéricas con dos decimales y los totales coinciden al centavo', async () => {
    const hoja = await leerExcel(await generar('xlsx'));

    expect(hoja.getCell('C6').value).toBe(1234.5);
    expect(hoja.getCell('C6').numFmt).toBe('#,##0.00');
    expect(hoja.getCell('C8').value).toBe(1234.6);
    expect(hoja.getCell('B8').value).toBe(4);
  });

  it('un texto que empieza como fórmula se escribe como texto con un apóstrofo, nunca como fórmula', async () => {
    const hoja = await leerExcel(await generar('xlsx'));
    const celda = hoja.getCell('A6');

    expect(celda.type).toBe(ExcelJS.ValueType.String);
    expect(celda.value).toBe('\'=HYPERLINK("http://malo.example","clic")');
  });

  it.each(['=1+1', '+1', '-1', '@SUMA', '\tx', '\rx'])('escapa %j', (texto) => {
    expect(sinFormula(texto)).toBe(`'${texto}`);
  });

  it('no toca un texto normal', () => {
    expect(sinFormula('Tenis 3-1')).toBe('Tenis 3-1');
  });

  it('las fechas van en hora de Guatemala', async () => {
    const tabla: TablaReporte = {
      ...TABLA,
      columnas: ['Carrito', 'Última actividad'],
      filas: [[7, new Date('2026-10-30T12:00:00.000Z')]],
      totales: null,
    };

    const hoja = await leerExcel(await generar('xlsx', tabla));

    expect(hoja.getCell('B6').value).toEqual(new Date('2026-10-30T06:00:00.000Z'));
    expect(hoja.getCell('B6').numFmt).toBe('dd/mm/yyyy hh:mm');
  });
});

describe('generador de PDF (E7-H05)', () => {
  it('produce un PDF', async () => {
    const archivo = await generar('pdf');

    expect(archivo.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('la definición lleva "datos al", las filas y los totales con dos decimales', () => {
    const texto = JSON.stringify(definicionPdf(TABLA, DATOS_AL));

    expect(texto).toContain('Datos al 02/11/2026 09:30 (hora de Guatemala)');
    expect(texto).toContain('"1,234.50"');
    expect(texto).toContain('"1,234.60"');
  });

  it('los montos llevan separador de miles y dos decimales; las fechas, la hora de Guatemala', () => {
    expect(textoPdf(new Decimal('1234567.5'))).toBe('1,234,567.50');
    expect(textoPdf(new Decimal('-5'))).toBe('-5.00');
    expect(textoPdf(new Date('2026-10-30T12:00:00.000Z'))).toBe('30/10/2026 06:00');
    expect(textoPdf(null)).toBe('');
  });
});
