import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// A-08: z extendido con .openapi(); los esquemas de la API se importan desde aquí.
extendZodWithOpenApi(z);

export { z };
