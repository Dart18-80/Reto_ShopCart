-- N-17: borrado físico de una dirección del cliente de la petición (los pedidos copian la dirección, M-04).
-- Una dirección ajena responde igual que una inexistente (50001, RF-01).
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Eliminar
    @IDDireccion    INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    BEGIN TRY
        BEGIN TRAN;
        DELETE FROM dbo.Direccion WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuarioActor;

        IF @@ROWCOUNT = 0
            THROW 50001, N'La dirección no existe.', 1;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
