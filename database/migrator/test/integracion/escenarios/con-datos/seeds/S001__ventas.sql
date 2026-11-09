-- Escenario de prueba (A-27): mil filas después de crear las estadísticas, como la semilla demo.
INSERT INTO dbo.Venta (IDVenta, Dia)
SELECT TOP (1000)
       ROW_NUMBER() OVER (ORDER BY (SELECT NULL)),
       DATEADD(DAY, -(ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) % 90), CONVERT(DATE, '2026-11-01'))
FROM sys.all_objects AS a CROSS JOIN sys.all_objects AS b;
