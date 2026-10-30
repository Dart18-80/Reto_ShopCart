-- Solo existe en shopcart_test: existencia física de una variante y cuántos movimientos tiene en el kardex.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_LeerKardex
    @IDVariante     INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT v.ExistenciaFisica,
           (SELECT COUNT(*) FROM dbo.MovimientoKardex AS m WHERE m.IDVariante = v.IDVariante) AS Movimientos
    FROM   dbo.Variante AS v
    WHERE  v.IDVariante = @IDVariante;
END
GO
