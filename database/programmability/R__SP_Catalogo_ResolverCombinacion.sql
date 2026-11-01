-- Interno (lo usan SP_Catalogo_CrearVariante y SP_Catalogo_ActualizarVariante, con el producto ya
-- bloqueado): valida la combinación de una variante (arreglo JSON de IDs de ValorAtributo, A-22) y devuelve
-- su firma canónica y su descripción. N-14: todas las variantes del producto usan el mismo conjunto de
-- atributos, deducido de las demás (incluidas las inactivas; @IDVarianteExcluida es la que se edita). Si no
-- hay otras, el conjunto está libre. Uno distinto responde 50207 con los esperados en detalles (A-19).
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ResolverCombinacion
    @IDProducto         INT,
    @IDVarianteExcluida INT,
    @Valores            NVARCHAR(MAX),
    @Firma              VARCHAR(200)  OUTPUT,
    @Descripcion        NVARCHAR(200) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF @@TRANCOUNT = 0
        THROW 50003, N'SP_Catalogo_ResolverCombinacion debe ejecutarse dentro de una transacción.', 1;

    DECLARE @LargoMaximo INT = 200;

    IF ISJSON(@Valores) <> 1 OR LEFT(LTRIM(@Valores), 1) <> N'['
        THROW 50003, N'La lista de valores de atributo no es válida.', 1;

    DECLARE @Cantidad INT, @Distintos INT, @Atributos INT, @Inexistentes INT,
            @FirmaLarga VARCHAR(MAX), @DescripcionLarga NVARCHAR(MAX), @Conjunto VARCHAR(MAX);
    SELECT @Cantidad = c.Valores, @Distintos = c.ValoresDistintos, @Atributos = c.Atributos,
           @Inexistentes = c.Inexistentes, @FirmaLarga = c.Firma, @DescripcionLarga = c.Descripcion,
           @Conjunto = c.ConjuntoAtributos
    FROM   dbo.FU_Catalogo_CombinacionVariante(@Valores) AS c;

    IF @Inexistentes > 0
        THROW 50003, N'Un valor de atributo no existe.', 1;
    IF @Distintos <> @Cantidad
        THROW 50003, N'La lista repite un valor de atributo.', 1;
    IF @Atributos <> @Cantidad
        THROW 50003, N'Una variante lleva un solo valor por atributo.', 1;
    IF LEN(@FirmaLarga) > @LargoMaximo OR LEN(@DescripcionLarga) > @LargoMaximo
        THROW 50003, N'La combinación tiene demasiados atributos.', 1;

    DECLARE @Referencia INT = (SELECT MIN(IDVariante) FROM dbo.Variante
                               WHERE IDProducto = @IDProducto
                                 AND IDVariante <> COALESCE(@IDVarianteExcluida, 0));
    IF @Referencia IS NOT NULL
       AND @Conjunto <> (SELECT COALESCE(STRING_AGG(CONVERT(VARCHAR(MAX), vva.IDAtributo), '|')
                                         WITHIN GROUP (ORDER BY vva.IDAtributo), '')
                         FROM dbo.VarianteValorAtributo AS vva WHERE vva.IDVariante = @Referencia)
    BEGIN
        DECLARE @Error NVARCHAR(2048) = (
            SELECT N'La variante debe usar los mismos atributos que las demás del producto.' AS mensaje,
                   JSON_QUERY(COALESCE((
                       SELECT a.IDAtributo AS idAtributo, a.Nombre AS nombre
                       FROM   dbo.VarianteValorAtributo AS vva
                       JOIN   dbo.Atributo AS a ON a.IDAtributo = vva.IDAtributo
                       WHERE  vva.IDVariante = @Referencia
                       ORDER BY a.Orden, a.IDAtributo
                       FOR JSON PATH), N'[]')) AS [detalles.atributosEsperados]
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        THROW 50207, @Error, 1;
    END

    SET @Firma = @FirmaLarga;
    SET @Descripcion = @DescripcionLarga;
END
GO
