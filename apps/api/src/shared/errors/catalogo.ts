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
  // Un SP interno llamado sin lo que exige (transacción, actor o rol). Error de programación: 500, log en
  // error y mensaje genérico; el detalle del SP queda solo en el log.
  INVARIANTE_INTERNA: {
    http: 500,
    numeroSql: 50005,
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
  // N-14: una categoría que usan cupones o pedidos no se borra, solo se desactiva.
  CATEGORIA_EN_USO: {
    http: 409,
    numeroSql: 50209,
    mensaje: 'La categoría está en cupones o en pedidos.',
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
    mensaje: 'El cupón ya se usó: solo se pueden cambiar su vigencia, sus límites y su estado.',
  },
  CUPON_CODIGO_DUPLICADO: {
    http: 409,
    numeroSql: 50510,
    mensaje: 'Ya existe un cupón con ese código.',
  },
  // A-13: CK_Cupon_UsosComprometidos rechaza el cambio; el SP lo traduce con los usos en los detalles.
  CUPON_LIMITE_BAJO_USOS: {
    http: 422,
    numeroSql: 50511,
    mensaje: 'El límite de usos no puede ser menor que los usos ya comprometidos.',
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
  // N-03: la pasarela no respondió; el resultado es incierto y el reintento con la misma llave lo resuelve.
  PAGO_SIN_CONFIRMAR: {
    http: 504,
    numeroSql: 50606,
    mensaje: 'No pudimos confirmar tu pago. Puedes reintentar: no se te cobrará dos veces.',
  },
  // N-03: la conciliación cerró el intento sin cobro (Fallido o Anulado); es la respuesta de un reintento
  // con la misma llave.
  PAGO_NO_COMPLETADO: {
    http: 409,
    numeroSql: 50607,
    mensaje: 'Tu pago no se completó y no se hizo ningún cobro. Vuelve a intentarlo.',
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
  // Decisión del PO (cierre de la Fase 1): el pago está en revisión manual (V019).
  PAGO_EN_REVISION: {
    http: 409,
    numeroSql: 50706,
    mensaje: 'El pago de este pedido está en verificación.',
  },
  // E9-H04 (decisión del PO): la revisión manual de pagos y reembolsos. Las tres últimas nacen en la API, con lo
  // que la pasarela dice del cobro.
  PAGO_NO_EN_REVISION: {
    http: 409,
    numeroSql: 50707,
    mensaje: 'Este pago ya no está en revisión: alguien lo resolvió antes.',
  },
  RESOLUCION_NO_APLICA: {
    http: 422,
    numeroSql: 50708,
    mensaje: 'Esa resolución no corresponde a este pago.',
  },
  REEMBOLSO_NO_FALLIDO: {
    http: 409,
    numeroSql: 50709,
    mensaje: 'Solo se resuelve a mano un reembolso Fallido.',
  },
  // Decisión del PO (E9-H04): un pedido solo avanza desde Pagado con su cobro Capturado.
  PAGO_NO_CAPTURADO: {
    http: 409,
    numeroSql: 50710,
    mensaje: 'El cobro de este pedido aún no se confirma.',
  },
  COBRO_SIN_CAPTURA: {
    http: 409,
    mensaje:
      'La pasarela no muestra el cobro capturado: no se puede dar por verificado ni reembolsar.',
  },
  COBRO_CAPTURADO: {
    http: 409,
    mensaje:
      'La pasarela muestra el cobro capturado: verifica el cobro en lugar de cancelar sin cobro.',
  },
  PASARELA_SIN_RESPUESTA: {
    http: 504,
    mensaje: 'La pasarela no respondió. Vuelve a intentarlo.',
  },

  // Exportaciones (50800–50899, E7-H05). Las dos últimas nacen en la API.
  EXPORTACIONES_PENDIENTES_MAXIMAS: {
    http: 429,
    numeroSql: 50801,
    mensaje: 'Ya tienes el máximo de exportaciones en curso. Espera a que terminen.',
  },
  EXPORTACION_NO_LISTA: { http: 409, mensaje: 'La exportación todavía no está lista.' },
  EXPORTACION_EXPIRADA: { http: 410, mensaje: 'La exportación expiró. Vuelve a solicitarla.' },

  // Envíos (50900–50999, N-04).
  METODO_ENVIO_ULTIMO_ACTIVO: {
    http: 409,
    numeroSql: 50901,
    mensaje:
      'Debe quedar al menos un método de envío activo: activa otro antes de desactivar este.',
  },

  // Dashboard en tiempo real (E9-H02, A-25). Nace en la API.
  CONEXIONES_MAXIMAS: {
    http: 429,
    mensaje:
      'Ya tienes demasiadas conexiones abiertas al dashboard en tiempo real. Cierra alguna pestaña.',
  },
} as const satisfies Record<string, EntradaCatalogo>;

export type CodigoError = keyof typeof CATALOGO;

// Object.entries pierde el tipo de la llave; las llaves salen del propio CATALOGO, así que el cast es seguro.
const CODIGO_POR_NUMERO = new Map<number, CodigoError>(
  Object.entries(CATALOGO).flatMap(([codigo, entrada]) =>
    'numeroSql' in entrada ? [[entrada.numeroSql, codigo as CodigoError] as const] : [],
  ),
);

/** Un código guardado como texto (por ejemplo, el de un intento de pago anulado) que existe en el catálogo. */
export function esCodigoError(texto: string): texto is CodigoError {
  return Object.hasOwn(CATALOGO, texto);
}

export function codigoPorNumeroSql(numero: number): CodigoError | undefined {
  return CODIGO_POR_NUMERO.get(numero);
}
