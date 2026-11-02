-- Interno (sqlserver-sp §7): cancela la sesión de checkout Activa del cliente, si la tiene, y libera lo que
-- tenía apartado: sus reservas (N-06) y el uso reservado del cupón (N-12, contador con CHECK de A-13).
-- Lo usan la fusión del carrito (N-05) y, en E5, el reinicio del pago (N-02).
-- Bloquea la sesión antes de cambiarla; liberar reservas no necesita el bloqueo de las variantes, porque
-- solo aumenta el disponible (sqlserver-sp §9.1).
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_CancelarSesionActiva
    @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @@TRANCOUNT = 0
        THROW 50005, N'SP_Checkout_CancelarSesionActiva debe ejecutarse dentro de una transacción.', 1;

    DECLARE @IDSesionCheckout INT =
    (
        SELECT s.IDSesionCheckout
        FROM   dbo.SesionCheckout AS s WITH (UPDLOCK, ROWLOCK)
        WHERE  s.IDUsuario = @IDUsuario AND s.Estado = 'Activa'
    );

    IF @IDSesionCheckout IS NULL
        RETURN;

    UPDATE dbo.Reserva
    SET    Estado = 'Liberada', FechaCierre = SYSUTCDATETIME()
    WHERE  IDSesionCheckout = @IDSesionCheckout AND Estado = 'Activa';

    DECLARE @Usos TABLE (IDCupon INT NOT NULL);

    UPDATE dbo.UsoCupon
    SET    Estado = 'Liberado', FechaActualizacion = SYSUTCDATETIME()
    OUTPUT inserted.IDCupon INTO @Usos
    WHERE  IDSesionCheckout = @IDSesionCheckout AND Estado = 'Reservado';

    UPDATE c
    SET    UsosComprometidos = c.UsosComprometidos - 1
    FROM   dbo.Cupon AS c
    JOIN   @Usos     AS u ON u.IDCupon = c.IDCupon;

    UPDATE dbo.SesionCheckout
    SET    Estado = 'Cancelada', FechaCierre = SYSUTCDATETIME(), FechaActualizacion = SYSUTCDATETIME()
    WHERE  IDSesionCheckout = @IDSesionCheckout;
END
GO
