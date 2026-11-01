-- N-14: activa o desactiva una categoría. No se desactiva mientras tenga productos activos.
-- Orden de bloqueo: la categoría y después el rango de sus productos (HOLDLOCK sobre
-- IX_Producto_Categoria_Activo), el mismo que debe seguir todo SP que crea o activa un producto (E3-H03):
-- así un producto no se activa en una categoría que se está desactivando. Devuelve la categoría.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CambiarEstadoCategoria
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

    BEGIN TRY
        BEGIN TRAN;

        DECLARE @ActivoActual BIT;
        SELECT @ActivoActual = c.Activo
        FROM   dbo.Categoria AS c WITH (UPDLOCK, ROWLOCK)
        WHERE  c.IDCategoria = @IDCategoria;

        IF @ActivoActual IS NULL
            THROW 50001, N'La categoría no existe.', 1;

        IF @Activo = 0
           AND EXISTS (SELECT 1 FROM dbo.Producto WITH (UPDLOCK, HOLDLOCK)
                       WHERE IDCategoria = @IDCategoria AND Activo = 1)
            THROW 50204, N'La categoría tiene productos activos: desactívalos o muévelos antes.', 1;

        IF @ActivoActual <> @Activo
            UPDATE dbo.Categoria
            SET    Activo = @Activo, FechaActualizacion = SYSUTCDATETIME()
            WHERE  IDCategoria = @IDCategoria;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT c.IDCategoria, c.Nombre, c.Descripcion, c.Activo
    FROM   dbo.Categoria AS c
    WHERE  c.IDCategoria = @IDCategoria;
END
GO
