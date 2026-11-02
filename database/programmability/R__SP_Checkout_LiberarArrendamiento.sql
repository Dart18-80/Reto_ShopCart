-- N-03: ante un timeout de la pasarela, el servicio libera de inmediato el arrendamiento del intento (sigue en
-- curso, con el resultado incierto): el reintento con la misma llave lo retoma sin esperar, y si nadie
-- reintenta, la conciliación lo resuelve. Solo el cliente dueño del intento y solo si el arrendamiento sigue
-- siendo suyo (@TokenArrendamiento, fencing): no libera el que ya tomó otro proceso.
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_LiberarArrendamiento
    @IDIntentoPago      BIGINT,
    @TokenArrendamiento UNIQUEIDENTIFIER,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE i
        SET    ArrendadoHasta = SYSUTCDATETIME(), FechaActualizacion = SYSUTCDATETIME()
        FROM   dbo.IntentoPago AS i WITH (UPDLOCK, ROWLOCK)
        JOIN   dbo.SesionCheckout AS s ON s.IDSesionCheckout = i.IDSesionCheckout
        WHERE  i.IDIntentoPago = @IDIntentoPago AND i.Estado IN ('Pendiente', 'Autorizado')
          AND  i.TokenArrendamiento = @TokenArrendamiento
          AND  s.IDUsuario = @IDUsuarioActor AND @RolActor = 'Cliente';

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
