-- Solo existe en shopcart_test: llama a SP_Inventario_ReservarExistencia dentro de una transacción, como lo hace
-- un SP de entrada, y devuelve las reservas de la sesión.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_ReservarExistencia
    @IDSesionCheckout  INT,
    @Lineas            NVARCHAR(MAX),
    @MinutosParaVencer INT              = 15,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @Vence DATETIME2(3) = DATEADD(MINUTE, @MinutosParaVencer, SYSUTCDATETIME());

    BEGIN TRY
        BEGIN TRAN;
        EXEC dbo.SP_Inventario_ReservarExistencia @IDSesionCheckout, @Lineas, @Vence;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT r.IDReserva, r.IDVariante, r.Cantidad, r.Estado,
           CONVERT(BIT, IIF(r.FechaExpiracion > SYSUTCDATETIME(), 1, 0)) AS Vigente
    FROM   dbo.Reserva AS r
    WHERE  r.IDSesionCheckout = @IDSesionCheckout
    ORDER BY r.IDVariante;
END
GO
