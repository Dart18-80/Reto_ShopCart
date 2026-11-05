-- RF-02: el Admin edita una categoría. PATCH (sqlserver-sp §9.5): NULL significa "sin cambio" y
-- @QuitarDescripcion = 1 la deja sin descripción; la mezcla se hace en el UPDATE, bajo bloqueo.
-- Devuelve la categoría.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ActualizarCategoria
    @IDCategoria       INT,
    @Nombre            NVARCHAR(80),
    @Descripcion       NVARCHAR(300),
    @QuitarDescripcion BIT              = 0,
    @Ilustracion       VARCHAR(20)      = NULL,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @QuitarDescripcion = 1 AND @Descripcion IS NOT NULL
        THROW 50003, N'No se puede enviar una descripción y quitarla a la vez.', 1;

    BEGIN TRY
        BEGIN TRAN;

        IF @Nombre IS NOT NULL
           AND EXISTS (SELECT 1 FROM dbo.Categoria WITH (UPDLOCK, HOLDLOCK)
                       WHERE Nombre = @Nombre AND IDCategoria <> @IDCategoria)
            THROW 50205, N'Ya existe una categoría con ese nombre.', 1;

        UPDATE dbo.Categoria
        SET    Nombre             = COALESCE(@Nombre, Nombre),
               Descripcion        = CASE WHEN @QuitarDescripcion = 1 THEN NULL
                                         ELSE COALESCE(@Descripcion, Descripcion) END,
               Ilustracion        = COALESCE(@Ilustracion, Ilustracion),
               FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDCategoria = @IDCategoria;

        IF @@ROWCOUNT = 0
            THROW 50001, N'La categoría no existe.', 1;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627) AND ERROR_MESSAGE() LIKE N'%UQ_Categoria_Nombre%'
            THROW 50205, N'Ya existe una categoría con ese nombre.', 1;
        THROW;
    END CATCH

    SELECT c.IDCategoria, c.Nombre, c.Descripcion, c.Ilustracion, c.Activo
    FROM   dbo.Categoria AS c
    WHERE  c.IDCategoria = @IDCategoria;
END
GO
