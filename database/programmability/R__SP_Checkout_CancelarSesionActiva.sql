-- Interno (sqlserver-sp §7): cancela la sesión de checkout Activa del cliente, si la tiene, y libera lo que
-- tenía apartado por la única ruta de liberación: SP_Inventario_LiberarReservas (N-06) y
-- SP_Cupones_LiberarUso (N-12, A-13). Lo usan el reinicio del pago (E5-H01), su cancelación y la fusión del
-- carrito (N-05). Una sesión con un pago en curso (intento Pendiente o Autorizado) no se cancela: 50602. La
-- fusión del login se pospone así con FusionPendiente.
-- Orden de bloqueo (01 §6.6): la sesión y después el cupón (dentro de SP_Cupones_LiberarUso).
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

    IF EXISTS (SELECT 1 FROM dbo.IntentoPago AS i
               WHERE i.IDSesionCheckout = @IDSesionCheckout AND i.Estado IN ('Pendiente', 'Autorizado'))
        THROW 50602, N'Hay un pago en curso: espera a que termine antes de cambiar tu compra.', 1;

    EXEC dbo.SP_Inventario_LiberarReservas @IDSesionCheckout;
    EXEC dbo.SP_Cupones_LiberarUso @IDSesionCheckout;

    UPDATE dbo.SesionCheckout
    SET    Estado = 'Cancelada', FechaCierre = SYSUTCDATETIME(), FechaActualizacion = SYSUTCDATETIME()
    WHERE  IDSesionCheckout = @IDSesionCheckout;
END
GO
