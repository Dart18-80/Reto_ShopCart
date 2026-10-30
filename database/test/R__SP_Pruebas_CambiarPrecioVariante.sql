-- Solo existe en shopcart_test: cierra el precio vigente e inserta uno nuevo (como lo hará
-- SP_Catalogo_CambiarPrecio), con el actor de la petición, para comprobar la bitácora de precios.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CambiarPrecioVariante
    @IDVariante     INT,
    @Precio         DECIMAL(12,2),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();

    BEGIN TRY
        BEGIN TRAN;
        UPDATE dbo.PrecioVariante SET VigenteHasta = @Ahora WHERE IDVariante = @IDVariante AND VigenteHasta IS NULL;
        INSERT INTO dbo.PrecioVariante (IDVariante, Precio, VigenteDesde, IDUsuario)
        VALUES (@IDVariante, @Precio, DATEADD(MILLISECOND, 1, @Ahora), @IDUsuarioActor);
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
