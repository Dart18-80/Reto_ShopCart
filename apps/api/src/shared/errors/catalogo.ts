interface EntradaCatalogo {
  http: number;
  /** Número del THROW en los SPs (02-modelo-datos.md §8); ausente si el error nace en la API. */
  numeroSql?: number;
  /** Mensaje por defecto; los SPs envían el suyo. */
  mensaje: string;
}

// A-06: código estable → HTTP. Cada THROW nuevo de un SP se agrega aquí en el mismo commit.
export const CATALOGO = {
  // Errores que nacen en la API
  VALIDACION_FALLIDA: { http: 400, mensaje: 'Los datos enviados no son válidos.' },
  JSON_INVALIDO: { http: 400, mensaje: 'El cuerpo de la petición no es un JSON válido.' },
  CUERPO_DEMASIADO_GRANDE: { http: 413, mensaje: 'El cuerpo de la petición es demasiado grande.' },
  CONTENIDO_NO_SOPORTADO: {
    http: 415,
    mensaje: 'El tipo o la codificación del contenido no es compatible.',
  },
  // N-15: el mismo mensaje para correo inexistente y contraseña incorrecta.
  CREDENCIALES_INVALIDAS: { http: 401, mensaje: 'Correo o contraseña incorrectos.' },
  NO_AUTENTICADO: { http: 401, mensaje: 'Inicia sesión para continuar.' },
  SIN_PERMISO: { http: 403, mensaje: 'No tienes permiso para esta operación.' },
  DEMASIADAS_PETICIONES: {
    http: 429,
    mensaje: 'Demasiados intentos. Espera un momento e intenta de nuevo.',
  },
  ERROR_INTERNO: { http: 500, mensaje: 'Ocurrió un error inesperado. Intenta de nuevo más tarde.' },

  // 50001–50099 General
  NO_ENCONTRADO: { http: 404, numeroSql: 50001, mensaje: 'El recurso no existe.' },
  CONFLICTO_CONCURRENCIA: {
    http: 409,
    numeroSql: 50002,
    mensaje: 'El recurso cambió mientras lo editabas. Recarga e intenta de nuevo.',
  },
  PARAMETRO_INVALIDO: { http: 400, numeroSql: 50003, mensaje: 'Un parámetro no es válido.' },
  // A-18: un trigger de bitácora sin Rol en SESSION_CONTEXT. Es un error de programación: 500.
  CONTEXTO_NO_ESTABLECIDO: {
    http: 500,
    numeroSql: 50004,
    mensaje: 'Ocurrió un error inesperado. Intenta de nuevo más tarde.',
  },

  // 50100–50199 Auth y usuarios
  CORREO_EN_USO: { http: 409, numeroSql: 50101, mensaje: 'El correo ya está registrado.' },
  REFRESH_REUTILIZADO: { http: 401, numeroSql: 50102, mensaje: 'La sesión ya no es válida.' },
  USUARIO_INACTIVO: { http: 401, numeroSql: 50103, mensaje: 'El usuario está inactivo.' },
  ACCION_SOBRE_SI_MISMO: {
    http: 409,
    numeroSql: 50105,
    mensaje: 'No puedes desactivar tu propia cuenta ni cambiar tu propio rol.',
  },
  ULTIMO_ADMIN: {
    http: 409,
    numeroSql: 50104,
    mensaje: 'El sistema debe conservar al menos un administrador activo.',
  },

  // E2-H05: tope de direcciones por cliente (N-17).
  LIMITE_DIRECCIONES: {
    http: 422,
    numeroSql: 50106,
    mensaje: 'Alcanzaste el máximo de 10 direcciones.',
  },

  // 50200–50299 Catálogo
  SKU_DUPLICADO: { http: 409, numeroSql: 50201, mensaje: 'El SKU ya existe.' },
  COMBINACION_DUPLICADA: {
    http: 409,
    numeroSql: 50202,
    mensaje: 'Ya existe una variante con esa combinación de atributos.',
  },
  PRODUCTO_CON_HISTORIAL: {
    http: 409,
    numeroSql: 50203,
    mensaje: 'El producto tiene historial y no se puede eliminar.',
  },
  CATEGORIA_CON_PRODUCTOS: {
    http: 409,
    numeroSql: 50204,
    mensaje: 'La categoría tiene productos asociados.',
  },
  // E3-H01, E3-H02: nombre de categoría o de atributo, o valor dentro de un atributo, ya usado.
  NOMBRE_DUPLICADO: {
    http: 409,
    numeroSql: 50205,
    mensaje: 'Ya existe un registro con ese nombre.',
  },
  // N-14: un producto activo siempre tiene su categoría activa.
  CATEGORIA_INACTIVA: { http: 409, numeroSql: 50206, mensaje: 'La categoría está inactiva.' },
  // N-14: todas las variantes de un producto usan el mismo conjunto de atributos (los esperados en detalles).
  ATRIBUTOS_NO_COINCIDEN: {
    http: 422,
    numeroSql: 50207,
    mensaje: 'La variante debe usar los mismos atributos que las demás del producto.',
  },
  // N-14: la combinación de una variante con historial no se cambia.
  VARIANTE_CON_HISTORIAL: {
    http: 409,
    numeroSql: 50208,
    mensaje: 'La variante tiene historial: desactívala y crea otra variante.',
  },

  // 50300–50399 Inventario
  STOCK_INSUFICIENTE: { http: 409, numeroSql: 50301, mensaje: 'No hay existencia suficiente.' },
  AJUSTE_DEJA_NEGATIVO: {
    http: 422,
    numeroSql: 50302,
    mensaje: 'El ajuste dejaría la existencia en negativo.',
  },
  AJUSTE_BAJO_RESERVADO: {
    http: 422,
    numeroSql: 50303,
    mensaje: 'Hay unidades reservadas en pagos en curso.',
  },
  MOTIVO_REQUERIDO: { http: 400, numeroSql: 50304, mensaje: 'El movimiento requiere un motivo.' },

  // 50400–50499 Carrito
  LIMITE_LINEAS: {
    http: 422,
    numeroSql: 50401,
    mensaje: 'El carrito alcanzó el límite de líneas.',
  },
  LINEAS_NO_DISPONIBLES: {
    http: 409,
    numeroSql: 50402,
    mensaje: 'Algunos productos del carrito ya no están disponibles.',
  },
  CARRITO_VACIO: { http: 422, numeroSql: 50403, mensaje: 'El carrito está vacío.' },

  // 50500–50599 Cupones
  CUPON_NO_EXISTE: { http: 422, numeroSql: 50501, mensaje: 'El cupón no existe.' },
  CUPON_INACTIVO: { http: 422, numeroSql: 50502, mensaje: 'El cupón no está activo.' },
  CUPON_NO_VIGENTE_AUN: { http: 422, numeroSql: 50503, mensaje: 'El cupón todavía no es válido.' },
  CUPON_VENCIDO: { http: 422, numeroSql: 50504, mensaje: 'El cupón ya venció.' },
  CUPON_AGOTADO: { http: 422, numeroSql: 50505, mensaje: 'El cupón alcanzó su límite de usos.' },
  CUPON_LIMITE_CLIENTE: {
    http: 422,
    numeroSql: 50506,
    mensaje: 'Ya usaste este cupón el máximo de veces permitido.',
  },
  CUPON_MINIMO_NO_ALCANZADO: {
    http: 422,
    numeroSql: 50507,
    mensaje: 'El carrito no alcanza la compra mínima del cupón.',
  },
  CUPON_SIN_PRODUCTOS_CATEGORIA: {
    http: 422,
    numeroSql: 50508,
    mensaje: 'El carrito no tiene productos de la categoría del cupón.',
  },
  CUPON_USADO_NO_EDITABLE: {
    http: 409,
    numeroSql: 50509,
    mensaje: 'El cupón ya se usó y no se puede editar.',
  },

  // 50600–50699 Checkout y pago
  SESION_VENCIDA: { http: 409, numeroSql: 50601, mensaje: 'La sesión de pago venció.' },
  PAGO_EN_CURSO: { http: 409, numeroSql: 50602, mensaje: 'Ya hay un pago en curso.' },
  LLAVE_REUTILIZADA: {
    http: 422,
    numeroSql: 50603,
    mensaje: 'La llave de idempotencia ya se usó con otra solicitud.',
  },
  PAGO_RECHAZADO: { http: 402, numeroSql: 50604, mensaje: 'El pago fue rechazado.' },
  MAX_INTENTOS: {
    http: 409,
    numeroSql: 50605,
    mensaje: 'Se alcanzó el máximo de intentos de pago.',
  },

  // 50700–50799 Pedidos
  TRANSICION_INVALIDA: {
    http: 409,
    numeroSql: 50701,
    mensaje: 'El pedido no puede pasar a ese estado.',
  },
  NO_CANCELABLE: { http: 409, numeroSql: 50702, mensaje: 'El pedido ya no se puede cancelar.' },
  DEVOLUCION_EXCEDE_VENDIDO: {
    http: 422,
    numeroSql: 50703,
    mensaje: 'La devolución excede lo vendido.',
  },
  PLAZO_DEVOLUCION_VENCIDO: {
    http: 422,
    numeroSql: 50704,
    mensaje: 'El plazo de devolución venció.',
  },
  REEMBOLSO_EXCEDE_TOTAL: {
    http: 422,
    numeroSql: 50705,
    mensaje: 'El reembolso excede el total pagado.',
  },
} as const satisfies Record<string, EntradaCatalogo>;

export type CodigoError = keyof typeof CATALOGO;

// Object.entries pierde el tipo de la llave; las llaves salen del propio CATALOGO, así que el cast es seguro.
const CODIGO_POR_NUMERO = new Map<number, CodigoError>(
  Object.entries(CATALOGO).flatMap(([codigo, entrada]) =>
    'numeroSql' in entrada ? [[entrada.numeroSql, codigo as CodigoError] as const] : [],
  ),
);

export function codigoPorNumeroSql(numero: number): CodigoError | undefined {
  return CODIGO_POR_NUMERO.get(numero);
}
