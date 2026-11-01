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

        -- Mismo orden de bloqueo que SP_Direcciones_Crear y SP_Direcciones_Actualizar: primero todas las
        -- direcciones del cliente (por IX_Direccion_IDUsuario) y después la fila. Borrar directo por la PK
        -- bloqueaba al revés (fila y después índice) y se cruzaba en un deadlock con un cambio de la
        -- predeterminada.
        DECLARE @EsPropia INT;
        SELECT @EsPropia = MAX(CASE WHEN IDDireccion = @IDDireccion THEN 1 ELSE 0 END)
        FROM   dbo.Direccion WITH (UPDLOCK, HOLDLOCK)
        WHERE  IDUsuario = @IDUsuarioActor;

        IF ISNULL(@EsPropia, 0) = 0
            THROW 50001, N'La dirección no existe.', 1;

        DELETE FROM dbo.Direccion WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuarioActor;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
