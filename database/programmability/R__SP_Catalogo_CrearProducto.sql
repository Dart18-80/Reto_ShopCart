-- RF-02, N-14: el Admin crea un producto. Un producto activo siempre tiene su categoría activa: crearlo
-- activo en una categoría inactiva responde 50206; inactivo sí se permite. Orden de bloqueo (01 §6.6): la
-- categoría primero, igual que SP_Catalogo_CambiarEstadoCategoria. Devuelve el producto (detalle de Admin).
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearProducto
    @IDCategoria    INT,
    @Nombre         NVARCHAR(150),
    @Descripcion    NVARCHAR(2000),
    @Activo         BIT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDProducto INT, @CategoriaActiva BIT;

    BEGIN TRY
        BEGIN TRAN;

        SELECT @CategoriaActiva = c.Activo
        FROM   dbo.Categoria AS c WITH (UPDLOCK, ROWLOCK)
        WHERE  c.IDCategoria = @IDCategoria;

        IF @CategoriaActiva IS NULL
            THROW 50003, N'La categoría no existe.', 1;
        IF @Activo = 1 AND @CategoriaActiva = 0
            THROW 50206, N'La categoría está inactiva: activa la categoría o crea el producto inactivo.', 1;

        INSERT INTO dbo.Producto (IDCategoria, Nombre, Descripcion, Activo)
        VALUES (@IDCategoria, @Nombre, @Descripcion, @Activo);
        SET @IDProducto = SCOPE_IDENTITY();

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Catalogo_ObtenerProductoAdmin @IDProducto = @IDProducto;
END
GO
