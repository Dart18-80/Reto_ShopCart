// A-08: z extendido antes de evaluar @shopcart/shared (ver shared/openapi/zod.ts).
import '../openapi/zod.js';

// A-12: la web filtra por días de Guatemala con el mismo esquema (@shopcart/shared).
export { rangoDeFechasSchema } from '@shopcart/shared';
