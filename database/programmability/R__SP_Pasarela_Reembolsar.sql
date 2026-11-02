-- N-03, N-09 (E5-H02): la pasarela simulada reembolsa parte o todo de una transacción capturada. Idempotente
-- por llave: la misma llave devuelve el mismo reembolso. Nunca reembolsa más de lo capturado (se valida bajo
-- el bloqueo de la autorización). Solo la usa el adaptador PasarelaSimulada.
CREATE OR ALTER PROCEDURE dbo.SP_Pasarela_Reembolsar
    @LlaveIdempotencia UNIQUEIDENTIFIER,
    @IDTransaccion     VARCHAR(64),
    @Monto             DECIMAL(12,2),
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @Estado VARCHAR(12), @Capturado DECIMAL(12,2);

    BEGIN TRY
        BEGIN TRAN;

        SELECT @Estado = a.Estado, @Capturado = a.Monto
        FROM   dbo.PasarelaAutorizacion AS a WITH (UPDLOCK, ROWLOCK)
        WHERE  a.IDTransaccion = @IDTransaccion;

        IF NOT EXISTS (SELECT 1 FROM dbo.PasarelaReembolso AS r WITH (UPDLOCK, HOLDLOCK)
                       WHERE r.LlaveIdempotencia = @LlaveIdempotencia)
        BEGIN
            IF @Estado IS NULL
                THROW 50001, N'La transacción no existe en la pasarela.', 1;
            IF @Estado <> 'Capturada'
                THROW 50002, N'Solo se reembolsa una transacción capturada.', 1;
            IF @Monto + (SELECT COALESCE(SUM(r.Monto), 0) FROM dbo.PasarelaReembolso AS r
                         WHERE r.IDTransaccion = @IDTransaccion) > @Capturado
                THROW 50002, N'El reembolso excede lo capturado.', 1;

            INSERT INTO dbo.PasarelaReembolso (LlaveIdempotencia, IDTransaccion, IDReembolso, Monto)
            VALUES (@LlaveIdempotencia, @IDTransaccion, 'SIMR-' + REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''),
                    @Monto);
        END

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT r.IDReembolso FROM dbo.PasarelaReembolso AS r WHERE r.LlaveIdempotencia = @LlaveIdempotencia;
END
GO
