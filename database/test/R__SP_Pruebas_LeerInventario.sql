-- Solo existe en shopcart_test: devuelve el disponible de una variante (FU_Inventario_Disponible) y,
-- en un segundo conjunto, sus filas en VW_Inventario_Conciliacion (vacío si cuadra).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_LeerInventario
    @IDVariante     INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT d.ExistenciaFisica, d.Reservado, d.Disponible
    FROM   dbo.FU_Inventario_Disponible(@IDVariante) AS d;

    SELECT c.IDVariante, c.ExistenciaFisica, c.SumaKardex, c.ExistenciaUltimoMovimiento
    FROM   dbo.VW_Inventario_Conciliacion AS c
    WHERE  c.IDVariante = @IDVariante;
END
GO
