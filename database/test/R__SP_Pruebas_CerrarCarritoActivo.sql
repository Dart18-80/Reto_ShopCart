-- Solo existe en shopcart_test: pasa el carrito Activo del usuario a Convertido (como lo hará la confirmación
-- del pago en E5), para que su siguiente producto abra un carrito nuevo mientras una sesión de checkout del
-- carrito anterior sigue activa (límite por cliente de N-12).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CerrarCarritoActivo
    @IDUsuario      INT,
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
        UPDATE dbo.Carrito
        SET    Estado = 'Convertido', FechaCierre = SYSUTCDATETIME()
        WHERE  IDUsuario = @IDUsuario AND Estado = 'Activo';
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
