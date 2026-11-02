-- N-03 (E5-H02): la pasarela simulada autoriza un cobro. Idempotente por llave: si la llave ya existe,
-- devuelve la misma respuesta (Nueva = 0) sin cambiar nada, aunque la pida otra réplica; con otro monto u otra
-- tarjeta (marca y últimos 4) es otra solicitud: 50603, como cualquier pasarela con llaves de idempotencia. La decisión
-- (@Aprobada y el código de rechazo) la toma el adaptador con la tarjeta de prueba; aquí nunca llega el número
-- completo ni el CVV. Solo la usa el adaptador PasarelaSimulada, nunca dentro de una transacción del checkout.
CREATE OR ALTER PROCEDURE dbo.SP_Pasarela_Autorizar
    @LlaveIdempotencia UNIQUEIDENTIFIER,
    @Monto             DECIMAL(12,2),
    @Marca             VARCHAR(20),
    @UltimosDigitos    CHAR(4),
    @Aprobada          BIT,
    @CodigoRechazo     VARCHAR(30)      = NULL,
    @MensajeRechazo    NVARCHAR(200)    = NULL,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @Nueva BIT = 0;

    BEGIN TRY
        BEGIN TRAN;

        -- sqlserver-sp §9.3: HOLDLOCK bloquea también el hueco de una llave nueva.
        IF EXISTS (SELECT 1 FROM dbo.PasarelaAutorizacion AS a WITH (UPDLOCK, HOLDLOCK)
                   WHERE a.LlaveIdempotencia = @LlaveIdempotencia
                     AND (a.Monto <> @Monto OR a.Marca <> @Marca OR a.UltimosDigitos <> @UltimosDigitos))
            THROW 50603, N'La llave de idempotencia ya se usó con otra solicitud.', 1;

        IF NOT EXISTS (SELECT 1 FROM dbo.PasarelaAutorizacion AS a WITH (UPDLOCK, HOLDLOCK)
                       WHERE a.LlaveIdempotencia = @LlaveIdempotencia)
        BEGIN
            INSERT INTO dbo.PasarelaAutorizacion (LlaveIdempotencia, IDTransaccion, Monto, Marca, UltimosDigitos,
                                                  Estado, CodigoRespuesta, MensajeRespuesta)
            VALUES (@LlaveIdempotencia, 'SIM-' + REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), @Monto, @Marca,
                    @UltimosDigitos, IIF(@Aprobada = 1, 'Autorizada', 'Rechazada'),
                    IIF(@Aprobada = 1, NULL, @CodigoRechazo), IIF(@Aprobada = 1, NULL, @MensajeRechazo));
            SET @Nueva = 1;
        END

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT a.IDTransaccion, a.Estado, a.Marca, a.UltimosDigitos, a.CodigoRespuesta, a.MensajeRespuesta,
           @Nueva AS Nueva
    FROM   dbo.PasarelaAutorizacion AS a
    WHERE  a.LlaveIdempotencia = @LlaveIdempotencia;
END
GO
