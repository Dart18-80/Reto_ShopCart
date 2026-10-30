-- N-06: disponible = existencia física − reservas vigentes. Una reserva vencida no cuenta aunque
-- siga en estado 'Activa' (el job la libera después): así el disponible nunca depende del job.
-- Todo cálculo de disponible usa esta función; la fórmula no se repite en otro lado.
CREATE OR ALTER FUNCTION dbo.FU_Inventario_Disponible (@IDVariante INT)
RETURNS TABLE
AS
RETURN
    SELECT  v.IDVariante,
            v.ExistenciaFisica,
            r.Reservado,
            v.ExistenciaFisica - r.Reservado AS Disponible
    FROM    dbo.Variante AS v
    CROSS APPLY (
        SELECT COALESCE(SUM(re.Cantidad), 0) AS Reservado
        FROM   dbo.Reserva AS re
        WHERE  re.IDVariante = v.IDVariante
          AND  re.Estado = 'Activa'
          AND  re.FechaExpiracion > SYSUTCDATETIME()
    ) AS r
    WHERE   v.IDVariante = @IDVariante;
GO
