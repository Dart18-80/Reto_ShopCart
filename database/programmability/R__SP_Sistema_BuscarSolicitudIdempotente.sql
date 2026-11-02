-- Interno (sqlserver-sp §7, §9.3), E5-H03: busca la llave de idempotencia de una operación que no es un pago
-- (entrada o ajuste de inventario), con UPDLOCK, HOLDLOCK para bloquear también el hueco de una llave nueva.
-- Misma llave del mismo usuario con otra operación u otro contenido → 50603. Si ya se procesó, @Respuesta
-- trae lo guardado; si es nueva, NULL y el llamador la guarda con SP_Sistema_GuardarSolicitudIdempotente en la
-- misma transacción que el movimiento.
CREATE OR ALTER PROCEDURE dbo.SP_Sistema_BuscarSolicitudIdempotente
    @IDUsuario         INT,
    @LlaveIdempotencia UNIQUEIDENTIFIER,
    @Operacion         VARCHAR(40),
    @HashSolicitud     BINARY(32),
    @Respuesta         NVARCHAR(MAX) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF @@TRANCOUNT = 0
        THROW 50005, N'SP_Sistema_BuscarSolicitudIdempotente debe ejecutarse dentro de una transacción.', 1;

    DECLARE @OperacionGuardada VARCHAR(40), @HashGuardado BINARY(32);
    SET @Respuesta = NULL;

    SELECT @OperacionGuardada = s.Operacion, @HashGuardado = s.HashSolicitud, @Respuesta = s.Respuesta
    FROM   dbo.SolicitudIdempotente AS s WITH (UPDLOCK, HOLDLOCK)
    WHERE  s.IDUsuario = @IDUsuario AND s.LlaveIdempotencia = @LlaveIdempotencia;

    IF @Respuesta IS NOT NULL AND (@OperacionGuardada <> @Operacion OR @HashGuardado <> @HashSolicitud)
        THROW 50603, N'La llave de idempotencia ya se usó con otra solicitud.', 1;
END
GO
