-- Interno (sqlserver-sp §7), N-06, RF-07: libera las reservas Activa de una sesión de checkout (Liberada).
-- Es la única ruta de liberación: la usan la cancelación de la sesión, la expiración y el quinto rechazo.
-- No bloquea las variantes: liberar solo aumenta el disponible (sqlserver-sp §9.1).
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_LiberarReservas
    @IDSesionCheckout INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @@TRANCOUNT = 0
        THROW 50005, N'SP_Inventario_LiberarReservas debe ejecutarse dentro de una transacción.', 1;

    UPDATE dbo.Reserva
    SET    Estado = 'Liberada', FechaCierre = SYSUTCDATETIME()
    WHERE  IDSesionCheckout = @IDSesionCheckout AND Estado = 'Activa';
END
GO
