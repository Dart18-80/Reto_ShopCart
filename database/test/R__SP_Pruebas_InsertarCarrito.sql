-- Solo existe en shopcart_test: inserta un carrito activo tal cual llega, para comprobar
-- CK_Carrito_DuenoUnico (cliente o invitado, nunca ambos ni ninguno).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_InsertarCarrito
    @IDUsuario         INT              = NULL,
    @HashTokenInvitado BINARY(32)       = NULL,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    BEGIN TRY
        BEGIN TRAN;
        INSERT INTO dbo.Carrito (IDUsuario, HashTokenInvitado, Estado) VALUES (@IDUsuario, @HashTokenInvitado, 'Activo');

        SELECT CONVERT(INT, SCOPE_IDENTITY()) AS IDCarrito;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
