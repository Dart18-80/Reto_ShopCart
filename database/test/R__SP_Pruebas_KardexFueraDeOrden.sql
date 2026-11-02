-- Solo existe en shopcart_test: N-07, dentro de una variante las fechas del kardex nunca retroceden. Compara, en
-- toda la base, el orden por fecha con el orden por ID y el saldo anterior que deja cada uno.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_KardexFueraDeOrden
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    WITH Kardex AS (
        SELECT ROW_NUMBER() OVER (PARTITION BY m.IDVariante ORDER BY m.Fecha, m.IDMovimientoKardex) AS PorFecha,
               ROW_NUMBER() OVER (PARTITION BY m.IDVariante ORDER BY m.IDMovimientoKardex) AS PorID,
               LAG(m.ExistenciaResultante) OVER (PARTITION BY m.IDVariante
                                                 ORDER BY m.Fecha, m.IDMovimientoKardex) AS SaldoPrevioPorFecha,
               LAG(m.ExistenciaResultante) OVER (PARTITION BY m.IDVariante
                                                 ORDER BY m.IDMovimientoKardex) AS SaldoPrevioPorID
        FROM   dbo.MovimientoKardex AS m)
    SELECT COUNT(*) AS Movimientos,
           COUNT(CASE WHEN k.PorFecha <> k.PorID THEN 1 END) AS FueraDeOrden,
           COUNT(CASE WHEN ISNULL(k.SaldoPrevioPorFecha, -1) <> ISNULL(k.SaldoPrevioPorID, -1) THEN 1 END)
               AS SaldosDistintos
    FROM   Kardex AS k;
END
GO
