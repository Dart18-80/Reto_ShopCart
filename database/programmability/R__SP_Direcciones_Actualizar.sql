-- N-17: el cliente de la petición edita una de sus direcciones con los valores finales. Una dirección ajena
-- responde igual que una inexistente (50001, RF-01). Si queda como predeterminada, la anterior deja de
-- serlo en la misma transacción. Devuelve la dirección.
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Actualizar
    @IDDireccion      INT,
    @Alias            NVARCHAR(50),
    @NombreRecibe     NVARCHAR(100),
    @TelefonoRecibe   VARCHAR(8),
    @IDMunicipio      INT,
    @DireccionLinea   NVARCHAR(200),
    @Referencia       NVARCHAR(200),
    @EsPredeterminada BIT,
    @IDUsuarioActor   INT              = NULL,
    @RolActor         VARCHAR(20)      = NULL,
    @RequestId        UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF NOT EXISTS (SELECT 1 FROM dbo.Municipio WHERE IDMunicipio = @IDMunicipio)
        THROW 50003, N'El municipio no existe.', 1;

    BEGIN TRY
        BEGIN TRAN;

        IF NOT EXISTS (SELECT 1 FROM dbo.Direccion WITH (UPDLOCK, ROWLOCK)
                       WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuarioActor)
            THROW 50001, N'La dirección no existe.', 1;

        IF @EsPredeterminada = 1
            UPDATE dbo.Direccion
            SET    EsPredeterminada = 0, FechaActualizacion = SYSUTCDATETIME()
            WHERE  IDUsuario = @IDUsuarioActor AND EsPredeterminada = 1 AND IDDireccion <> @IDDireccion;

        UPDATE dbo.Direccion
        SET    Alias = @Alias, NombreRecibe = @NombreRecibe, TelefonoRecibe = @TelefonoRecibe,
               IDMunicipio = @IDMunicipio, DireccionLinea = @DireccionLinea, Referencia = @Referencia,
               EsPredeterminada = @EsPredeterminada, FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDDireccion = @IDDireccion AND IDUsuario = @IDUsuarioActor;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Direcciones_Listar @IDDireccion = @IDDireccion, @IDUsuarioActor = @IDUsuarioActor;
END
GO
