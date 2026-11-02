import sql from 'mssql';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../../../src/app.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { invitadoConCarrito, primeraLinea, varianteVendible } from '../carrito/apoyo-carrito.js';
import { unaFila } from '../datos-de-prueba.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const MS_POR_DIA = 24 * 60 * 60 * 1000;
const TOLERANCIA_MS = 60_000;

const fijarDiasGarantia = async (dias: number): Promise<number> =>
  (
    await unaFila<{ DiasGarantiaPrecio: number }>('SP_Pruebas_FijarDiasGarantiaPrecio', {
      Dias: { tipo: sql.TinyInt, valor: dias },
    })
  ).DiasGarantiaPrecio;

describe('el plazo de la garantía sale de ParametroSistema (E4-H02, N-02)', () => {
  it('con DiasGarantiaPrecio = 7, una línea nueva queda garantizada 7 días', async () => {
    const { IDVariante } = await varianteVendible();
    const anterior = await fijarDiasGarantia(7);
    try {
      const antes = Date.now();
      const { carrito } = await invitadoConCarrito(app, IDVariante);

      const plazo = Date.parse(primeraLinea(carrito).garantiaHasta) - antes;
      expect(Math.abs(plazo - 7 * MS_POR_DIA)).toBeLessThan(TOLERANCIA_MS);
    } finally {
      await fijarDiasGarantia(anterior);
    }
  });
});
