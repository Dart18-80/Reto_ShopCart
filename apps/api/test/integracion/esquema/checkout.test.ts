import { randomBytes } from 'node:crypto';
import sql from 'mssql';
import { describe, expect, it } from 'vitest';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import {
  crearCupon,
  crearSesionCheckout,
  crearUsuario,
  ERROR_DE_CONSTRAINT,
  ERROR_DE_INDICE_UNICO,
} from '../datos-de-prueba.js';

usarBaseDePruebas();

function fijarUsosCupon(idCupon: number, usosComprometidos: number) {
  return ejecutarSP('SP_Pruebas_FijarUsosCupon', {
    IDCupon: { tipo: sql.Int, valor: idCupon },
    UsosComprometidos: { tipo: sql.Int, valor: usosComprometidos },
  });
}

function insertarIntentoPago(idSesionCheckout: number, estado: string) {
  return ejecutarSP('SP_Pruebas_InsertarIntentoPago', {
    IDSesionCheckout: { tipo: sql.Int, valor: idSesionCheckout },
    Estado: { tipo: sql.VarChar(12), valor: estado },
  });
}

function insertarCarrito(idUsuario: number | null, hashTokenInvitado: Buffer | null) {
  return ejecutarSP('SP_Pruebas_InsertarCarrito', {
    IDUsuario: { tipo: sql.Int, valor: idUsuario },
    HashTokenInvitado: { tipo: sql.VarBinary(32), valor: hashTokenInvitado },
  });
}

describe('Cupon (E1-H03, A-13)', () => {
  it('acepta UsosComprometidos igual al límite', async () => {
    const idCupon = await crearCupon(3);

    await expect(fijarUsosCupon(idCupon, 3)).resolves.toBeDefined();
  });

  it('rechaza UsosComprometidos mayor que LimiteUsosTotal', async () => {
    const idCupon = await crearCupon(3);

    await expect(fijarUsosCupon(idCupon, 4)).rejects.toMatchObject({
      number: ERROR_DE_CONSTRAINT,
      message: expect.stringContaining('CK_Cupon_UsosComprometidos') as unknown,
    });
  });
});

describe('SesionCheckout (E1-H03, N-02)', () => {
  it('rechaza una segunda sesión Activa para el mismo usuario', async () => {
    const idUsuario = await crearUsuario();
    await crearSesionCheckout(idUsuario);

    await expect(crearSesionCheckout(idUsuario)).rejects.toMatchObject({
      number: ERROR_DE_INDICE_UNICO,
      message: expect.stringContaining('UX_SesionCheckout_ActivaPorUsuario') as unknown,
    });
  });
});

describe('IntentoPago (E1-H03, N-03)', () => {
  it('rechaza un segundo intento Pendiente en la misma sesión', async () => {
    const idSesion = await crearSesionCheckout(await crearUsuario());
    await insertarIntentoPago(idSesion, 'Pendiente');

    await expect(insertarIntentoPago(idSesion, 'Pendiente')).rejects.toMatchObject({
      number: ERROR_DE_INDICE_UNICO,
      message: expect.stringContaining('UX_IntentoPago_EnCursoPorSesion') as unknown,
    });
  });

  it('permite un nuevo intento cuando el anterior ya terminó (Rechazado)', async () => {
    const idSesion = await crearSesionCheckout(await crearUsuario());
    await insertarIntentoPago(idSesion, 'Rechazado');

    await expect(insertarIntentoPago(idSesion, 'Pendiente')).resolves.toHaveLength(1);
  });
});

describe('Carrito (E1-H03)', () => {
  it('acepta un carrito de cliente', async () => {
    await expect(insertarCarrito(await crearUsuario(), null)).resolves.toHaveLength(1);
  });

  it('acepta un carrito de invitado', async () => {
    await expect(insertarCarrito(null, randomBytes(32))).resolves.toHaveLength(1);
  });

  it('rechaza un carrito con cliente y token de invitado a la vez', async () => {
    const intento = insertarCarrito(await crearUsuario(), randomBytes(32));

    await expect(intento).rejects.toMatchObject({
      number: ERROR_DE_CONSTRAINT,
      message: expect.stringContaining('CK_Carrito_DuenoUnico') as unknown,
    });
  });

  it('rechaza un carrito sin cliente ni token de invitado', async () => {
    await expect(insertarCarrito(null, null)).rejects.toMatchObject({
      number: ERROR_DE_CONSTRAINT,
      message: expect.stringContaining('CK_Carrito_DuenoUnico') as unknown,
    });
  });
});
