/**
 * La página del dashboard trae Recharts: su primera carga diferida, bajo la carga de `pnpm test`, puede pasar de los
 * 5 s de una prueba. Los archivos de prueba que llegan a ella la cargan una vez antes, fuera de esos plazos.
 */
export const PLAZO_DE_PRECARGA_MS = 30_000;

export async function precargarDashboard(): Promise<void> {
  await import('../modules/reportes/paginas/DashboardPagina');
}
