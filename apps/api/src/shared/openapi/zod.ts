import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// A-08: z extendido con .openapi(); los esquemas de la API se importan desde aquí. Zod 4 asigna los métodos al
// crear cada esquema, así que los de @shopcart/shared solo tienen .openapi() si se evalúan después de esta
// extensión: los módulos de la API que reexportan algo de shared importan este archivo antes.
extendZodWithOpenApi(z);

export { z };
