/**
 * Lee el header Cookie. Express 5 no lo interpreta y no se agrega cookie-parser (A-16). El objeto no
 * tiene prototipo: una cookie llamada __proto__ no toca Object.prototype.
 */
export function leerCookies(cabecera: string | undefined): Record<string, string> {
  const cookies = Object.create(null) as Record<string, string>;
  for (const par of (cabecera ?? '').split(';')) {
    const separador = par.indexOf('=');
    const nombre = par.slice(0, separador).trim();
    // Si una cookie llega repetida, el navegador manda primero la de ruta más específica.
    if (separador < 0 || nombre.length === 0 || nombre in cookies) continue;
    cookies[nombre] = decodificar(par.slice(separador + 1).trim());
  }
  return cookies;
}

function decodificar(valor: string): string {
  try {
    return decodeURIComponent(valor);
  } catch {
    // Un valor con un % suelto no es URI válido: se usa tal cual y lo rechaza el esquema que lo lea.
    return valor;
  }
}
