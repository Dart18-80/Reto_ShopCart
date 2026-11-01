-- RF-02: el Admin crea una categoría activa. El nombre es único sin distinguir mayúsculas (UQ_Categoria_Nombre
-- con la intercalación de la base). Devuelve la categoría.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearCategoria
    @Nombre         NVARCHAR(80),
    @Descripcion    NVARCHAR(300),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDCategoria INT;

    BEGIN TRY
        BEGIN TRAN;

        IF EXISTS (SELECT 1 FROM dbo.Categoria WITH (UPDLOCK, HOLDLOCK) WHERE Nombre = @Nombre)
            THROW 50205, N'Ya existe una categoría con ese nombre.', 1;

        INSERT INTO dbo.Categoria (Nombre, Descripcion) VALUES (@Nombre, @Descripcion);
        SET @IDCategoria = SCOPE_IDENTITY();

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        -- El UNIQUE de Nombre es la autoridad si dos altas llegan a la vez.
        IF ERROR_NUMBER() IN (2601, 2627) AND ERROR_MESSAGE() LIKE N'%UQ_Categoria_Nombre%'
            THROW 50205, N'Ya existe una categoría con ese nombre.', 1;
        THROW;
    END CATCH

    SELECT c.IDCategoria, c.Nombre, c.Descripcion, c.Activo
    FROM   dbo.Categoria AS c
    WHERE  c.IDCategoria = @IDCategoria;
END
GO
