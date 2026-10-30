-- Solo existe en shopcart_test: devuelve la bitácora de una entidad, de la más reciente a la más antigua.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_LeerBitacora
    @Entidad        VARCHAR(50),
    @IDEntidad      VARCHAR(50),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  b.IDBitacora, b.Modulo, b.Entidad, b.IDEntidad, b.Accion, b.ValorAnterior, b.ValorNuevo,
            b.IDUsuario, b.RequestId, b.Fecha
    FROM    dbo.Bitacora AS b
    WHERE   b.Entidad = @Entidad AND b.IDEntidad = @IDEntidad
    ORDER BY b.IDBitacora DESC;
END
GO
