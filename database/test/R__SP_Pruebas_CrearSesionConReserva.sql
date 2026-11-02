-- Solo existe en shopcart_test: una sesión de checkout Activa del usuario con una reserva Activa de la
-- variante y, si se indica, el uso reservado de un cupón (con su contador), para comprobar que la fusión del
-- carrito (N-05) cancela la sesión y libera lo apartado. Devuelve la sesión.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CrearSesionConReserva
    @IDUsuario      INT,
    @IDVariante     INT,
    @Cantidad       INT,
    @IDCupon        INT              = NULL,
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
        DECLARE @IDSesionCheckout INT = (SELECT IDSesionCheckout FROM @Sesion);

        INSERT INTO dbo.Reserva (IDSesionCheckout, IDVariante, Cantidad, Estado, FechaExpiracion)
        VALUES (@IDSesionCheckout, @IDVariante, @Cantidad, 'Activa', DATEADD(MINUTE, 15, SYSUTCDATETIME()));

        IF @IDCupon IS NOT NULL
        BEGIN
            INSERT INTO dbo.UsoCupon (IDCupon, IDUsuario, IDSesionCheckout, Estado, MontoDescuento)
            VALUES (@IDCupon, @IDUsuario, @IDSesionCheckout, 'Reservado', 0);
            UPDATE dbo.Cupon SET UsosComprometidos = UsosComprometidos + 1 WHERE IDCupon = @IDCupon;
        END

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT @IDSesionCheckout AS IDSesionCheckout;
END
GO
