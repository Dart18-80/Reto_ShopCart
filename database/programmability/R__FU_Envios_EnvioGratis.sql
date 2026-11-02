-- N-04: el envío gratis para un monto de productos ya con el cupón aplicado. Una fila: el mínimo
-- (ParametroSistema.MontoEnvioGratis; NULL = sin envío gratis), cuánto falta y si ya se alcanzó.
CREATE OR ALTER FUNCTION dbo.FU_Envios_EnvioGratis (@Monto DECIMAL(15,2))
RETURNS TABLE
AS
RETURN
    SELECT ps.MontoEnvioGratis AS MontoMinimo,
           CONVERT(DECIMAL(15,2), CASE WHEN ps.MontoEnvioGratis > @Monto THEN ps.MontoEnvioGratis - @Monto
                                       ELSE 0 END) AS Faltante,
           CONVERT(BIT, CASE WHEN ps.MontoEnvioGratis IS NOT NULL AND @Monto >= ps.MontoEnvioGratis
                             THEN 1 ELSE 0 END) AS Alcanzado
    FROM   (SELECT TOP (1) p.MontoEnvioGratis FROM dbo.ParametroSistema AS p ORDER BY p.IDParametroSistema) AS ps;
GO
