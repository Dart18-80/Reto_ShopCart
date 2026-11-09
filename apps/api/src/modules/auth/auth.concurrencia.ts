/**
 * Un semáforo por proceso: como mucho `maximo` tareas a la vez; las demás esperan en orden de llegada. El permiso se
 * devuelve siempre en `finally`, también si la tarea falla o lanza antes de devolver su promesa.
 */
export function crearLimiteDeConcurrencia(maximo: number) {
  let enCurso = 0;
  const enEspera: (() => void)[] = [];

  const tomar = async (): Promise<void> => {
    if (enCurso < maximo) {
      enCurso++;
      return;
    }
    // Quien libera entrega su permiso directo al siguiente: enCurso no baja ni sube.
    await new Promise<void>((entregar) => {
      enEspera.push(entregar);
    });
  };

  const liberar = (): void => {
    const siguiente = enEspera.shift();
    if (siguiente) siguiente();
    else enCurso--;
  };

  return async <T>(tarea: () => Promise<T>): Promise<T> => {
    await tomar();
    try {
      return await tarea();
    } finally {
      liberar();
    }
  };
}
