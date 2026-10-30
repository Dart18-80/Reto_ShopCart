-- Solo existe en shopcart_test: inserta un intento de pago con el estado indicado y una llave nueva,
-- para comprobar que la base permite un solo intento en curso por sesión (N-03).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_InsertarIntentoPago
    @IDSesionCheckout INT,
    @Estado           VARCHAR(12),
    @IDUsuarioActor   INT              = NULL,
    @RolActor         VARCHAR(20)      = NULL,
    @RequestId        UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    INSERT INTO dbo.IntentoPago (IDSesionCheckout, LlaveIdempotencia, HashSolicitud, Monto, Estado)
    VALUES (@IDSesionCheckout, NEWID(), HASHBYTES('SHA2_256', CONVERT(NVARCHAR(36), NEWID())), 135, @Estado);

    SELECT CONVERT(BIGINT, SCOPE_IDENTITY()) AS IDIntentoPago;
END
GO
