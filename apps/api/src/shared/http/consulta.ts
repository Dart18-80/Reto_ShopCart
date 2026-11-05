// A-08: z extendido antes de evaluar @shopcart/shared (ver shared/openapi/zod.ts).
import '../openapi/zod.js';

// La web valida los filtros de la URL con el mismo esquema (@shopcart/shared).
export { booleanoConsultaSchema } from '@shopcart/shared';
