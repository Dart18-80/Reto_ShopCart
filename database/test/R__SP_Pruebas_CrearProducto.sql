-- Solo existe en shopcart_test: crea un producto (activo o no) en una categoría dada, para probar las reglas
-- de categorías antes de que exista la administración de productos (E3-H03). Devuelve su ID.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CrearProducto
    @IDCategoria    INT,
    @Activo         BIT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDProducto INT;
    BEGIN TRY
        BEGIN TRAN;
        INSERT INTO dbo.Producto (IDCategoria, Nombre, Activo)
        VALUES (@IDCategoria, N'Producto ' + CONVERT(NVARCHAR(36), NEWID()), @Activo);
        SET @IDProducto = SCOPE_IDENTITY();
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT @IDProducto AS IDProducto;
END
GO
