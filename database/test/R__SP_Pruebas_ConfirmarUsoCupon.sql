-- Solo existe en shopcart_test: registra un uso Confirmado del cupón por el usuario, en una sesión de
-- checkout ya pagada (como lo hará la confirmación del pago en E5), para probar el límite por cliente (N-12).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_ConfirmarUsoCupon
    @IDUsuario      INT,
    @IDCupon        INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @Sesion TABLE (IDSesionCheckout INT);

    BEGIN TRY
        BEGIN TRAN;

        INSERT INTO @Sesion
        EXEC dbo.SP_Pruebas_CrearSesionCheckout @IDUsuario = @IDUsuario, @IDUsuarioActor = @IDUsuarioActor,
                                                @RolActor = @RolActor, @RequestId = @RequestId;

        UPDATE s
        SET    Estado = 'Pagada', FechaCierre = SYSUTCDATETIME()
        FROM   dbo.SesionCheckout AS s
        JOIN   @Sesion AS n ON n.IDSesionCheckout = s.IDSesionCheckout;

        INSERT INTO dbo.UsoCupon (IDCupon, IDUsuario, IDSesionCheckout, Estado, MontoDescuento)
        SELECT @IDCupon, @IDUsuario, n.IDSesionCheckout, 'Confirmado', 0
        FROM   @Sesion AS n;

        UPDATE dbo.Cupon SET UsosComprometidos = UsosComprometidos + 1 WHERE IDCupon = @IDCupon;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
