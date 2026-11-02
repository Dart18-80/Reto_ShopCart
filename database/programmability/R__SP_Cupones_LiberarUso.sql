-- Interno (sqlserver-sp §7), N-12, A-13: libera el uso Reservado del cupón de una sesión de checkout
-- (Liberado) y devuelve el uso al contador, con el cupón bloqueado. Es la única ruta de liberación del cupón:
-- la usan la cancelación de la sesión, la expiración y el quinto rechazo.
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_LiberarUso
    @IDSesionCheckout INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @@TRANCOUNT = 0
        THROW 50005, N'SP_Cupones_LiberarUso debe ejecutarse dentro de una transacción.', 1;

    DECLARE @IDCupon INT = (SELECT u.IDCupon FROM dbo.UsoCupon AS u
                            WHERE u.IDSesionCheckout = @IDSesionCheckout AND u.Estado = 'Reservado');
    IF @IDCupon IS NULL
        RETURN;

    -- 01 §6.6: el cupón es lo último que se bloquea.
    DECLARE @Bloqueado INT = (SELECT c.IDCupon FROM dbo.Cupon AS c WITH (UPDLOCK, ROWLOCK) WHERE c.IDCupon = @IDCupon);

    UPDATE dbo.UsoCupon
    SET    Estado = 'Liberado', FechaActualizacion = SYSUTCDATETIME()
    WHERE  IDSesionCheckout = @IDSesionCheckout AND Estado = 'Reservado';

    UPDATE dbo.Cupon SET UsosComprometidos = UsosComprometidos - 1 WHERE IDCupon = @Bloqueado;
END
GO
