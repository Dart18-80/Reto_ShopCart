-- N-07, RF-03: variantes cuya existencia física no cuadra con el kardex (VW_Inventario_Conciliacion).
-- Debe devolver cero filas.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_Conciliar
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT c.IDVariante, c.SKU, c.ExistenciaFisica, c.SumaKardex, c.ExistenciaUltimoMovimiento
    FROM   dbo.VW_Inventario_Conciliacion AS c
    ORDER BY c.IDVariante;
END
GO
