-- N-14: el Admin edita el SKU o la combinación de una variante (NULL = sin cambio). El SKU siempre se puede
-- cambiar (DetallePedido guarda su copia). La combinación solo cambia sin historial (ventas, kardex,
-- reservas o checkout) y dentro del conjunto de atributos del producto; con historial responde 50208.
-- Orden de bloqueo (01 §6.6): el producto y después la variante. La unicidad la deciden las UQ (50201,
-- 50202), igual que en SP_Catalogo_CrearVariante. Devuelve el producto.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ActualizarVariante
    @IDVariante     INT,
    @SKU            VARCHAR(40),
    @Valores        NVARCHAR(MAX),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    -- La variante nunca cambia de producto: leerlo sin bloqueo solo decide qué fila bloquear primero.
    DECLARE @IDProducto INT = (SELECT IDProducto FROM dbo.Variante WHERE IDVariante = @IDVariante);
    IF @IDProducto IS NULL
        THROW 50001, N'La variante no existe.', 1;

    BEGIN TRY
        BEGIN TRAN;

        DECLARE @Bloqueado INT, @FirmaActual VARCHAR(200), @Firma VARCHAR(200), @Descripcion NVARCHAR(200);
        SELECT @Bloqueado = p.IDProducto FROM dbo.Producto AS p WITH (UPDLOCK, ROWLOCK)
        WHERE  p.IDProducto = @IDProducto;
        SELECT @FirmaActual = v.FirmaAtributos FROM dbo.Variante AS v WITH (UPDLOCK, ROWLOCK)
        WHERE  v.IDVariante = @IDVariante;

        IF @FirmaActual IS NULL
            THROW 50001, N'La variante no existe.', 1;

        IF @Valores IS NOT NULL
        BEGIN
            EXEC dbo.SP_Catalogo_ResolverCombinacion
                 @IDProducto = @IDProducto, @IDVarianteExcluida = @IDVariante, @Valores = @Valores,
                 @Firma = @Firma OUTPUT, @Descripcion = @Descripcion OUTPUT;

            IF @Firma <> @FirmaActual
            BEGIN
                IF (SELECT h.TieneHistorial FROM dbo.FU_Catalogo_HistorialVariante(@IDVariante) AS h) = 1
                    THROW 50208, N'La variante tiene historial y su combinación no se cambia: desactívala y crea otra variante.', 1;

                UPDATE dbo.Variante
                SET    FirmaAtributos = @Firma, DescripcionAtributos = @Descripcion,
                       FechaActualizacion = SYSUTCDATETIME()
                WHERE  IDVariante = @IDVariante;

                DELETE FROM dbo.VarianteValorAtributo WHERE IDVariante = @IDVariante;
                INSERT INTO dbo.VarianteValorAtributo (IDVariante, IDAtributo, IDValorAtributo)
                SELECT @IDVariante, va.IDAtributo, va.IDValorAtributo
                FROM   OPENJSON(@Valores) WITH (IDValorAtributo INT '$') AS j
                JOIN   dbo.ValorAtributo AS va ON va.IDValorAtributo = j.IDValorAtributo;
            END
        END

        IF @SKU IS NOT NULL
            UPDATE dbo.Variante
            SET    SKU = @SKU, FechaActualizacion = SYSUTCDATETIME()
            WHERE  IDVariante = @IDVariante AND SKU <> @SKU;

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
