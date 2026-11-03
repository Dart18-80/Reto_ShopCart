import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../../src/app.js';
import { generarDocumentoOpenApi } from '../../../../src/shared/openapi/index.js';
import { dependenciasDePrueba } from '../../../app-de-prueba.js';

// E9-H04 (decisión del PO): el 409 de la resolución manual documenta el estado en que quedó el reembolso.
const esquemaDocumentado = z.object({
  properties: z.object({
    error: z.object({
      properties: z.object({
        detalles: z.object({
          properties: z.object({ estado: z.object({ enum: z.array(z.string()) }) }),
        }),
      }),
    }),
  }),
});

describe('OpenAPI de POST /admin/reembolsos/{id}/resolver', () => {
  it('su 409 lleva detalles.estado, con Completado y NoAplica entre los valores posibles', () => {
    crearApp(dependenciasDePrueba());

    const documento = generarDocumentoOpenApi();
    const respuesta = documento.paths?.['/api/v1/admin/reembolsos/{id}/resolver']?.post
      ?.responses?.['409'] as
      { content?: Record<string, { schema?: { $ref?: string } }> } | undefined;
    const referencia = respuesta?.content?.['application/json']?.schema?.$ref;
    const esquema = esquemaDocumentado.parse(
      documento.components?.schemas?.[referencia?.split('/').pop() ?? ''],
    );

    expect(referencia).toBe('#/components/schemas/ErrorResolucionReembolso');
    expect(esquema.properties.error.properties.detalles.properties.estado.enum).toEqual(
      expect.arrayContaining(['Completado', 'NoAplica']),
    );
  });
});
