-- RF-02, N-14: el Admin edita un producto. PATCH (sqlserver-sp §9.5): NULL significa "sin cambio" y
-- @QuitarDescripcion = 1 la deja sin descripción. Mover un producto activo a una categoría inactiva
-- responde 50206. Orden de bloqueo (01 §6.6): la categoría destino y después el producto.
-- Devuelve el producto (detalle de Admin).
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ActualizarProducto
    @IDProducto        INT,
    @IDCategoria       INT,
    @Nombre            NVARCHAR(150),
    @Descripcion       NVARCHAR(2000),
    @QuitarDescripcion BIT              = 0,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @QuitarDescripcion = 1 AND @Descripcion IS NOT NULL
        THROW 50003, N'No se puede enviar una descripción y quitarla a la vez.', 1;

    BEGIN TRY
        BEGIN TRAN;

        DECLARE @CategoriaActiva BIT, @ProductoActivo BIT;
        IF @IDCategoria IS NOT NULL
        BEGIN
            SELECT @CategoriaActiva = c.Activo
            FROM   dbo.Categoria AS c WITH (UPDLOCK, ROWLOCK)
            WHERE  c.IDCategoria = @IDCategoria;

            IF @CategoriaActiva IS NULL
                THROW 50003, N'La categoría no existe.', 1;
        END

        SELECT @ProductoActivo = p.Activo
        FROM   dbo.Producto AS p WITH (UPDLOCK, ROWLOCK)
        WHERE  p.IDProducto = @IDProducto;

        IF @ProductoActivo IS NULL
            THROW 50001, N'El producto no existe.', 1;
        IF @ProductoActivo = 1 AND @CategoriaActiva = 0
            THROW 50206, N'La categoría está inactiva: un producto activo no se puede mover a ella.', 1;

        UPDATE dbo.Producto
        SET    IDCategoria        = COALESCE(@IDCategoria, IDCategoria),
               Nombre             = COALESCE(@Nombre, Nombre),
               Descripcion        = CASE WHEN @QuitarDescripcion = 1 THEN NULL
                                         ELSE COALESCE(@Descripcion, Descripcion) END,
               FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDProducto = @IDProducto;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Catalogo_ObtenerProductoAdmin @IDProducto = @IDProducto;
END
GO
