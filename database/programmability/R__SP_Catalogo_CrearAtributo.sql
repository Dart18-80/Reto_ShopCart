-- N-14: el Admin crea un atributo (Talla, Color…) sin cambiar el esquema. Nombre único sin distinguir
-- mayúsculas (UQ_Atributo_Nombre). Sin @Orden, va después del último. Devuelve el atributo.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearAtributo
    @Nombre         NVARCHAR(50),
    @Orden          SMALLINT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDAtributo INT, @MaximoOrden SMALLINT = 32767;

    BEGIN TRY
        BEGIN TRAN;

        -- UPDLOCK + HOLDLOCK sobre la tabla: el nombre y el "siguiente orden" se leen sin que otra alta
        -- se cuele entre la lectura y el INSERT. Los atributos son pocos y se crean rara vez.
        IF EXISTS (SELECT 1 FROM dbo.Atributo WITH (UPDLOCK, HOLDLOCK) WHERE Nombre = @Nombre)
            THROW 50205, N'Ya existe un atributo con ese nombre.', 1;

        IF @Orden IS NULL
        BEGIN
            IF (SELECT MAX(Orden) FROM dbo.Atributo WITH (UPDLOCK, HOLDLOCK)) >= @MaximoOrden
                THROW 50003, N'No hay un orden disponible: indica uno.', 1;
            SET @Orden = (SELECT ISNULL(MAX(Orden), 0) + 1 FROM dbo.Atributo WITH (UPDLOCK, HOLDLOCK));
        END

        INSERT INTO dbo.Atributo (Nombre, Orden) VALUES (@Nombre, @Orden);
        SET @IDAtributo = SCOPE_IDENTITY();

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        -- El UNIQUE de Nombre es la autoridad si dos altas llegan a la vez.
        IF ERROR_NUMBER() IN (2601, 2627)
            THROW 50205, N'Ya existe un atributo con ese nombre.', 1;
        THROW;
    END CATCH

    SELECT a.IDAtributo, a.Nombre, a.Orden
    FROM   dbo.Atributo AS a
    WHERE  a.IDAtributo = @IDAtributo;
END
GO
