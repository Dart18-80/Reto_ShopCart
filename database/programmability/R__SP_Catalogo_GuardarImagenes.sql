-- N-19, A-22: reemplaza de forma atómica el conjunto de imágenes de un producto. @Imagenes es un arreglo
-- JSON [{ url, textoAlternativo, orden, esPrincipal }]; vacío las quita todas. Con imágenes, exactamente
-- una es la principal y ningún orden se repite (el SP lo valida; UX_ImagenProducto_Principal y
-- UQ_ImagenProducto_IDProductoOrden son la última defensa). Devuelve el producto (detalle de Admin).
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_GuardarImagenes
    @IDProducto     INT,
    @Imagenes       NVARCHAR(MAX),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF ISJSON(@Imagenes) <> 1 OR LEFT(LTRIM(@Imagenes), 1) <> N'['
        THROW 50003, N'La lista de imágenes no es válida.', 1;

    DECLARE @Lista TABLE (
        Url              NVARCHAR(500) NULL,
        TextoAlternativo NVARCHAR(150) NULL,
        Orden            SMALLINT      NULL,
        EsPrincipal      BIT           NULL
    );
    INSERT INTO @Lista (Url, TextoAlternativo, Orden, EsPrincipal)
    SELECT j.Url, j.TextoAlternativo, j.Orden, j.EsPrincipal
    FROM   OPENJSON(@Imagenes) WITH (
               Url              NVARCHAR(500) '$.url',
               TextoAlternativo NVARCHAR(150) '$.textoAlternativo',
               Orden            SMALLINT      '$.orden',
               EsPrincipal      BIT           '$.esPrincipal'
           ) AS j;

    IF EXISTS (SELECT 1 FROM @Lista
               WHERE Url IS NULL OR TextoAlternativo IS NULL OR Orden IS NULL OR EsPrincipal IS NULL)
        THROW 50003, N'Cada imagen necesita url, texto alternativo, orden y si es la principal.', 1;
    IF (SELECT COUNT(*) FROM @Lista) <> (SELECT COUNT(DISTINCT Orden) FROM @Lista)
        THROW 50003, N'Dos imágenes no pueden tener el mismo orden.', 1;
    IF EXISTS (SELECT 1 FROM @Lista)
       AND (SELECT COUNT(*) FROM @Lista WHERE EsPrincipal = 1) <> 1
        THROW 50003, N'Debe haber exactamente una imagen principal.', 1;

    BEGIN TRY
        BEGIN TRAN;

        IF NOT EXISTS (SELECT 1 FROM dbo.Producto WITH (UPDLOCK, ROWLOCK) WHERE IDProducto = @IDProducto)
            THROW 50001, N'El producto no existe.', 1;

        DELETE FROM dbo.ImagenProducto WHERE IDProducto = @IDProducto;

        INSERT INTO dbo.ImagenProducto (IDProducto, Url, TextoAlternativo, Orden, EsPrincipal)
        SELECT @IDProducto, Url, TextoAlternativo, Orden, EsPrincipal
        FROM   @Lista;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Catalogo_ObtenerProductoAdmin @IDProducto = @IDProducto;
END
GO
