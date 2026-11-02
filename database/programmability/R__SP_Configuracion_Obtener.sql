-- A-14: los parámetros del sistema (la fila única de ParametroSistema) para el Admin.
CREATE OR ALTER PROCEDURE dbo.SP_Configuracion_Obtener
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (1)
           p.DiasGarantiaPrecio, p.MinutosReserva, p.HorasCarritoAbandonado, p.DiasExpiracionCarritoInvitado,
           p.UmbralUltimasUnidades, p.MontoEnvioGratis, p.MaxIntentosPagoRechazados, p.DiasPlazoDevolucion,
           p.MaxLineasCarrito, p.FechaActualizacion
    FROM   dbo.ParametroSistema AS p
    ORDER BY p.IDParametroSistema;
END
GO
