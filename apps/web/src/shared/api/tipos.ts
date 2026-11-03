import type { paths } from '@shopcart/contrato';

type Ruta = keyof paths;
type MetodoHttp = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** Los métodos que una ruta del contrato tiene de verdad (openapi-typescript marca los demás como `never`). */
type MetodoDe<R extends Ruta> = {
  [M in MetodoHttp]: [NonNullable<paths[R][M]>] extends [never] ? never : M;
}[MetodoHttp];

type Operacion<R extends Ruta, M extends MetodoDe<R>> = NonNullable<paths[R][M]>;
type ContenidoJson<T> = T extends { content: { 'application/json': infer C } } ? C : never;
type Exitosas<O> = O extends { responses: infer Rs }
  ? Rs[Extract<keyof Rs, 200 | 201 | 202>]
  : never;

/** El JSON de la respuesta exitosa de una operación: `Respuesta<'/api/v1/pedidos/{id}', 'get'>`. */
export type Respuesta<R extends Ruta, M extends MetodoDe<R>> = ContenidoJson<
  Exitosas<Operacion<R, M>>
>;

/** El JSON que acepta una operación: `Cuerpo<'/api/v1/pedidos/{id}/cancelar', 'post'>`. */
export type Cuerpo<R extends Ruta, M extends MetodoDe<R>> =
  Operacion<R, M> extends { requestBody?: infer B } ? ContenidoJson<NonNullable<B>> : never;
