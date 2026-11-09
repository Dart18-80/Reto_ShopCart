-- A-27: estadísticas de tablas propias con filas que la primera consulta tendría que construir o actualizar:
-- nunca construidas (la tabla se creó vacía y la semilla la llenó después) o con modificaciones sin reflejar.
SELECT COUNT(*) AS Pendientes
FROM sys.stats AS s
JOIN sys.objects AS o ON o.object_id = s.object_id
OUTER APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) AS p
WHERE o.is_ms_shipped = 0
  AND (p.last_updated IS NULL OR p.modification_counter > 0)
  AND (SELECT SUM(pa.rows) FROM sys.partitions AS pa
       WHERE pa.object_id = s.object_id AND pa.index_id IN (0, 1)) > 0;
