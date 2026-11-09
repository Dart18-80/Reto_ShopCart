-- A-27: después de aplicar scripts (la semilla llena tablas que se crearon vacías), las estadísticas se construyen
-- aquí y no en la primera consulta de la API, que las actualizaría de forma síncrona dentro de su compilación
-- y con el bloqueo de compilación del SP tomado mientras tanto.
EXEC sys.sp_updatestats;
