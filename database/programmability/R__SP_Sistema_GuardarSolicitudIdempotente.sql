-- Interno (sqlserver-sp §7), E5-H03: guarda la llave de idempotencia y la respuesta de una operación, en la
-- misma transacción que la operación (nunca por separado). UQ_SolicitudIdempotente_IDUsuarioLlave es la
-- última defensa.
CREATE OR ALTER PROCEDURE dbo.SP_Sistema_GuardarSolicitudIdempotente
    @IDUsuario         INT,
    @LlaveIdempotencia UNIQUEIDENTIFIER,
    @Operacion         VARCHAR(40),
    @HashSolicitud     BINARY(32),
    @Respuesta         NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;

    IF @@TRANCOUNT = 0
        THROW 50005, N'SP_Sistema_GuardarSolicitudIdempotente debe ejecutarse dentro de una transacción.', 1;

    INSERT INTO dbo.SolicitudIdempotente (IDUsuario, LlaveIdempotencia, Operacion, HashSolicitud, Respuesta)
    VALUES (@IDUsuario, @LlaveIdempotencia, @Operacion, @HashSolicitud, @Respuesta);
END
GO
