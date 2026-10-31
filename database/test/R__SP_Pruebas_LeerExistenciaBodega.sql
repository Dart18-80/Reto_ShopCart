-- Solo existe en shopcart_test: la fila de VW_Inventario_ExistenciaBodega de una variante.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_LeerExistenciaBodega
    @IDVariante     INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT b.ExistenciaFisica, b.UnidadesPorDespachar, b.ExistenciaBodega
    FROM   dbo.VW_Inventario_ExistenciaBodega AS b
    WHERE  b.IDVariante = @IDVariante;
END
GO
