-- A-12, M-03: el día de Guatemala (UTC−6, sin horario de verano) de una fecha UTC. La usan SP_Pedidos_CrearPedido
-- (FechaPagoLocal) y las pruebas de medianoche: 05:59 UTC es el día anterior y 06:00 UTC el mismo día.
CREATE OR ALTER FUNCTION dbo.FU_Sistema_FechaLocal (@FechaUtc DATETIME2(3))
RETURNS TABLE
AS
RETURN
    SELECT CONVERT(DATE, DATEADD(HOUR, -6, @FechaUtc)) AS FechaLocal;
GO
