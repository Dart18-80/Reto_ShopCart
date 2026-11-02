-- Solo existe en shopcart_test: crea @Variantes variantes que se pueden vender (cada una en su propio
-- producto activo, con precio vigente y la existencia indicada registrada en el kardex) para las pruebas
-- del carrito. Devuelve una fila por variante.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CrearVarianteVendible
    @Precio         DECIMAL(12,2),
    @Existencia     INT,
    @Variantes      INT              = 1,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @Creadas TABLE (IDVariante INT PRIMARY KEY, IDUsuario INT, IDTipoEntrada INT, IDTipoSalida INT);

    BEGIN TRY
        BEGIN TRAN;

        DECLARE @Restantes INT = @Variantes;
        WHILE @Restantes > 0
        BEGIN
            INSERT INTO @Creadas
            EXEC dbo.SP_Pruebas_CrearVariante @IDUsuarioActor = @IDUsuarioActor, @RolActor = @RolActor,
                                              @RequestId = @RequestId;
            SET @Restantes -= 1;
        END

        INSERT INTO dbo.PrecioVariante (IDVariante, Precio, VigenteDesde, IDUsuario)
        SELECT c.IDVariante, @Precio, SYSUTCDATETIME(), c.IDUsuario
        FROM   @Creadas AS c;

        DECLARE @ID INT = (SELECT MIN(IDVariante) FROM @Creadas), @IDUsuario INT;
        WHILE @ID IS NOT NULL AND @Existencia > 0
        BEGIN
            -- El kardex exige un usuario responsable en el contexto (A-18).
            SET @IDUsuario = (SELECT IDUsuario FROM @Creadas WHERE IDVariante = @ID);
            EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuario, 'Sistema', @RequestId;
            EXEC dbo.SP_Inventario_RegistrarMovimiento
                 @IDVariante = @ID, @CodigoTipo = 'EntradaCompra', @Cantidad = @Existencia,
                 @Motivo = N'Existencia de prueba', @Referencia = NULL, @IDPedido = NULL, @IDDevolucion = NULL;
            SELECT @ID = MIN(IDVariante) FROM @Creadas WHERE IDVariante > @ID;
        END

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT v.IDProducto, c.IDVariante
    FROM   @Creadas AS c
    JOIN   dbo.Variante AS v ON v.IDVariante = c.IDVariante
    ORDER BY c.IDVariante;
END
GO
