-- N-14: activa o desactiva un producto. Un producto activo siempre tiene su categoría activa: activarlo en
-- una categoría inactiva responde 50206. Orden de bloqueo (01 §6.6): la categoría y después el producto,
-- el mismo que SP_Catalogo_CambiarEstadoCategoria, así activar el producto y desactivar su categoría a la
-- vez se serializan en la fila de la categoría. Devuelve el producto (detalle de Admin).
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CambiarEstadoProducto
    @IDProducto     INT,
    @Activo         BIT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    -- Sin bloqueo: solo para saber qué categoría bloquear primero; se vuelve a comprobar bajo bloqueo.
    DECLARE @IDCategoria INT = (SELECT IDCategoria FROM dbo.Producto WHERE IDProducto = @IDProducto);
    IF @IDCategoria IS NULL
        THROW 50001, N'El producto no existe.', 1;

    BEGIN TRY
        BEGIN TRAN;

        DECLARE @CategoriaActiva BIT, @CategoriaBloqueada INT, @ActivoActual BIT;
        SELECT @CategoriaActiva = c.Activo
        FROM   dbo.Categoria AS c WITH (UPDLOCK, ROWLOCK)
        WHERE  c.IDCategoria = @IDCategoria;

        SELECT @CategoriaBloqueada = p.IDCategoria, @ActivoActual = p.Activo
        FROM   dbo.Producto AS p WITH (UPDLOCK, ROWLOCK)
        WHERE  p.IDProducto = @IDProducto;

        -- Lo movieron de categoría entre la lectura y el bloqueo: la que se bloqueó ya no es la suya.
        IF @CategoriaBloqueada IS NULL OR @CategoriaBloqueada <> @IDCategoria
            THROW 50002, N'El producto cambió mientras lo editabas. Recarga e intenta de nuevo.', 1;
        IF @Activo = 1 AND @CategoriaActiva = 0
            THROW 50206, N'La categoría está inactiva: actívala antes de activar el producto.', 1;

        IF @ActivoActual <> @Activo
            UPDATE dbo.Producto
            SET    Activo = @Activo, FechaActualizacion = SYSUTCDATETIME()
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
