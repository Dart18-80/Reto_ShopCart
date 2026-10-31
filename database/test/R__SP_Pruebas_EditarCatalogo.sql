-- Solo existe en shopcart_test: sobre el producto y la categoría de una variante, cambia la descripción
-- de la categoría y desactiva el producto, para comprobar sus triggers de bitácora (RF-09).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_EditarCatalogo
    @IDVariante     INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDProducto INT, @IDCategoria INT;
    SELECT @IDProducto = p.IDProducto, @IDCategoria = p.IDCategoria
    FROM   dbo.Variante AS v
    JOIN   dbo.Producto AS p ON p.IDProducto = v.IDProducto
    WHERE  v.IDVariante = @IDVariante;

    BEGIN TRY
        BEGIN TRAN;
        UPDATE dbo.Categoria
        SET    Descripcion = N'Descripción editada', FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDCategoria = @IDCategoria;

        UPDATE dbo.Producto
        SET    Activo = 0, FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDProducto = @IDProducto;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT @IDProducto AS IDProducto, @IDCategoria AS IDCategoria;
END
GO
