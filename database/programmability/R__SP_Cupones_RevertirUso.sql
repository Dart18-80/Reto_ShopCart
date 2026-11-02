-- Interno (sqlserver-sp §7), N-09, A-13: al cancelar un pedido, su uso Confirmado del cupón pasa a Revertido y
-- devuelve el uso al contador, aunque el cupón ya haya vencido. El cupón se bloquea antes de tocar el contador.
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_RevertirUso
    @IDPedido INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @@TRANCOUNT = 0
        THROW 50005, N'SP_Cupones_RevertirUso debe ejecutarse dentro de una transacción.', 1;

    DECLARE @IDCupon INT = (SELECT u.IDCupon FROM dbo.UsoCupon AS u
                            WHERE u.IDPedido = @IDPedido AND u.Estado = 'Confirmado');
    IF @IDCupon IS NULL
        RETURN;

    DECLARE @Bloqueado INT = (SELECT c.IDCupon FROM dbo.Cupon AS c WITH (UPDLOCK, ROWLOCK) WHERE c.IDCupon = @IDCupon);

    UPDATE dbo.UsoCupon
    SET    Estado = 'Revertido', FechaActualizacion = SYSUTCDATETIME()
    WHERE  IDPedido = @IDPedido AND Estado = 'Confirmado';

    UPDATE dbo.Cupon SET UsosComprometidos = UsosComprometidos - 1 WHERE IDCupon = @Bloqueado;
END
GO
