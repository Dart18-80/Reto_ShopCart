-- RF-06: el cliente cancela su sesión de pago Activa (DELETE /checkout/sesion). Bloquea el carrito y libera
-- por la única ruta (SP_Checkout_CancelarSesionActiva): una sesión con un pago en curso responde 50602.
-- Sin sesión Activa, 50001.
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_CancelarSesion
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDCliente INT = CASE WHEN @RolActor = 'Cliente' THEN @IDUsuarioActor END;
    IF @IDCliente IS NULL
        THROW 50005, N'Solo un cliente puede cancelar su pago.', 1;

    DECLARE @IDCarrito INT;

    BEGIN TRY
        BEGIN TRAN;

        -- 01 §6.6: el carrito antes que la sesión.
        EXEC dbo.SP_Carrito_BloquearActivo @IDCliente, NULL, @IDCarrito OUTPUT;

        IF NOT EXISTS (SELECT 1 FROM dbo.SesionCheckout AS s WITH (UPDLOCK, ROWLOCK)
                       WHERE s.IDUsuario = @IDCliente AND s.Estado = 'Activa')
            THROW 50001, N'No tienes un pago en curso.', 1;

        EXEC dbo.SP_Checkout_CancelarSesionActiva @IDCliente;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
