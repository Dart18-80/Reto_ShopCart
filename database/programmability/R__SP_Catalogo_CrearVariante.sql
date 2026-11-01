-- N-14, A-22: el Admin crea una variante con SKU, combinación (arreglo JSON de IDs de ValorAtributo) y
-- precio inicial. SP_Catalogo_ResolverCombinacion valida la combinación y el conjunto de atributos del
-- producto y calcula la firma canónica y la descripción. La variante nace con existencia 0 y sin kardex
-- (el stock entra por inventario), y la primera versión de PrecioVariante se inserta en la misma
-- transacción. Orden de bloqueo (01 §6.6): la fila del producto antes de leer el conjunto, así dos altas
-- simultáneas nunca fijan dos conjuntos. La autoridad de la unicidad son UQ_Variante_SKU (50201) y
-- UQ_Variante_IDProductoFirmaAtributos (50202), traducidas en el CATCH. Devuelve el producto.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_CrearVariante
    @IDProducto     INT,
    @SKU            VARCHAR(40),
    @Valores        NVARCHAR(MAX),
    @Precio         DECIMAL(12,2),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @Precio IS NULL OR @Precio <= 0
        THROW 50003, N'El precio debe ser mayor que cero.', 1;

    DECLARE @IDVariante INT, @Firma VARCHAR(200), @Descripcion NVARCHAR(200);

    BEGIN TRY
        BEGIN TRAN;

        IF NOT EXISTS (SELECT 1 FROM dbo.Producto WITH (UPDLOCK, ROWLOCK) WHERE IDProducto = @IDProducto)
            THROW 50001, N'El producto no existe.', 1;

        EXEC dbo.SP_Catalogo_ResolverCombinacion
             @IDProducto = @IDProducto, @IDVarianteExcluida = NULL, @Valores = @Valores,
             @Firma = @Firma OUTPUT, @Descripcion = @Descripcion OUTPUT;

        INSERT INTO dbo.Variante (IDProducto, SKU, FirmaAtributos, DescripcionAtributos)
        VALUES (@IDProducto, @SKU, @Firma, @Descripcion);
        SET @IDVariante = SCOPE_IDENTITY();

        INSERT INTO dbo.VarianteValorAtributo (IDVariante, IDAtributo, IDValorAtributo)
        SELECT @IDVariante, va.IDAtributo, va.IDValorAtributo
        FROM   OPENJSON(@Valores) WITH (IDValorAtributo INT '$') AS j
        JOIN   dbo.ValorAtributo AS va ON va.IDValorAtributo = j.IDValorAtributo;

        INSERT INTO dbo.PrecioVariante (IDVariante, Precio, VigenteDesde, IDUsuario)
        VALUES (@IDVariante, @Precio, SYSUTCDATETIME(), @IDUsuarioActor);

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627) AND ERROR_MESSAGE() LIKE N'%UQ_Variante_SKU%'
            THROW 50201, N'El SKU ya existe.', 1;
        IF ERROR_NUMBER() IN (2601, 2627) AND ERROR_MESSAGE() LIKE N'%UQ_Variante_IDProductoFirmaAtributos%'
            THROW 50202, N'El producto ya tiene una variante con esa combinación de atributos.', 1;
        THROW;
    END CATCH

    EXEC dbo.SP_Catalogo_ObtenerProductoAdmin @IDProducto = @IDProducto;
END
GO
