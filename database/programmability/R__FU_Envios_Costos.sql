-- depende-de: R__FU_Envios_EnvioGratis.sql
-- N-04: los métodos de envío activos con su costo para un monto de productos ya con el cupón aplicado
-- (el cupón nunca aplica sobre el envío): la tarifa, o 0 si el monto alcanza el envío gratis. La usan la
-- consulta de métodos (E4-H06) y el checkout (E5).
CREATE OR ALTER FUNCTION dbo.FU_Envios_Costos (@Monto DECIMAL(15,2))
RETURNS TABLE
AS
RETURN
    SELECT m.IDMetodoEnvio, m.Codigo, m.Nombre, m.DiasMin, m.DiasMax,
           m.Costo AS Tarifa,
           CONVERT(DECIMAL(12,2), CASE WHEN g.Alcanzado = 1 THEN 0 ELSE m.Costo END) AS Costo,
           g.Alcanzado AS EnvioGratis
    FROM   dbo.MetodoEnvio AS m
    CROSS APPLY dbo.FU_Envios_EnvioGratis(@Monto) AS g
    WHERE  m.Activo = 1;
GO
