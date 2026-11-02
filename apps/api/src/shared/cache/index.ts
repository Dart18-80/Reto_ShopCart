/**
 * Puerto de caché (A-11). Redis solo guarda lo que se puede perder (RNF-2): ningún método lanza. Si Redis no
 * responde, el adaptador lo registra y la caché se comporta como vacía.
 */
export interface Cache {
  /** null si la clave no está o si Redis no responde. */
  obtener(clave: string): Promise<string | null>;
  guardar(clave: string, valor: string, segundos: number): Promise<void>;
  /** El valor de un contador (0 si todavía no existe); null si Redis no responde. */
  contador(clave: string): Promise<number | null>;
  incrementar(clave: string): Promise<void>;
}
