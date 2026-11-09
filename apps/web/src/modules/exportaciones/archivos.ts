// RFC 6266: `filename*=UTF-8''<codificado>` (con tildes) gana sobre `filename="<ascii>"`.
const PATRON_NOMBRE_UTF8 = /filename\*\s*=\s*UTF-8''([^;]+)/i;
const PATRON_NOMBRE = /filename\s*=\s*"?([^";]+)"?/i;

/** El último segmento: un nombre nunca elige la carpeta donde se guarda. */
const soloElNombre = (nombre: string) => nombre.split(/[/\\]/).at(-1) ?? '';

function decodificar(valor: string): string | null {
  try {
    return decodeURIComponent(valor.trim());
  } catch {
    // Un %XX inválido: se usa el filename ASCII o el de respaldo.
    return null;
  }
}

/** M11-H03: el nombre que el backend pone en Content-Disposition (el reporte y la fecha local). */
export function nombreDelArchivo(encabezado: string | null, respaldo: string): string {
  if (encabezado === null) return respaldo;
  const utf8 = PATRON_NOMBRE_UTF8.exec(encabezado)?.[1];
  const ascii = PATRON_NOMBRE.exec(encabezado)?.[1];
  const nombre = soloElNombre(
    (utf8 === undefined ? null : decodificar(utf8)) ?? ascii?.trim() ?? '',
  );
  return nombre === '' ? respaldo : nombre;
}

/** `Retry-After` en segundos, como lo manda el backend mientras la exportación no termina. */
export function segundosAMilisegundos(encabezado: string | null): number | null {
  const segundos = Number(encabezado);
  return encabezado !== null && Number.isFinite(segundos) && segundos > 0 ? segundos * 1000 : null;
}

// Revocar el enlace en el mismo instante del clic puede cortar la descarga en algunos navegadores; un minuto basta
// para que empiece y después se libera la memoria del archivo.
const VIDA_DEL_ENLACE_MS = 60_000;

/** Entrega el archivo al navegador para que lo guarde, con su nombre. */
export function guardarArchivo(archivo: Blob, nombre: string): void {
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, VIDA_DEL_ENLACE_MS);
}
