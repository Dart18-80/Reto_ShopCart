-- N-17: el cliente de la petición edita una de sus direcciones. PATCH: NULL significa "sin cambio";
-- @QuitarAlias y @QuitarReferencia vacían esos campos opcionales, y @EsPredeterminada solo cambia si llega.
-- La mezcla con lo guardado se hace en el UPDATE, bajo el bloqueo de las direcciones del cliente: dos PATCH
-- simultáneos conservan ambos cambios. Una dirección ajena responde igual que una inexistente (50001,
-- RF-01). Si queda como predeterminada, la anterior deja de serlo en la misma transacción.
-- Devuelve la dirección.
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Actualizar
    @IDDireccion      INT,
    @Alias            NVARCHAR(50),
    @QuitarAlias      BIT              = 0,
    @NombreRecibe     NVARCHAR(100),
    @TelefonoRecibe   VARCHAR(8),
    @IDMunicipio      INT,
    @DireccionLinea   NVARCHAR(200),
    @Referencia       NVARCHAR(200),
    @QuitarReferencia BIT              = 0,
    @EsPredeterminada BIT,
    @IDUsuarioActor   INT              = NULL,
    @RolActor         VARCHAR(20)      = NULL,
    @RequestId        UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF (@QuitarAlias = 1 AND @Alias IS NOT NULL) OR (@QuitarReferencia = 1 AND @Referencia IS NOT NULL)
        THROW 50003, N'No se puede enviar un campo y quitarlo a la vez.', 1;
    IF @IDMunicipio IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Municipio WHERE IDMunicipio = @IDMunicipio)
        THROW 50003, N'El municipio no existe.', 1;

    BEGIN TRY
        BEGIN TRAN;

        -- Bloquea todas las direcciones del cliente en el orden del índice, igual que SP_Direcciones_Crear:
        -- dos cambios simultáneos de la predeterminada se serializan. Bloquear solo la fila propia producía
        -- deadlocks al desmarcar la anterior (cada transacción esperaba la fila que tenía otra).
        DECLARE @EsPropia INT;
        SELECT @EsPropia = MAX(CASE WHEN IDDireccion = @IDDireccion THEN 1 ELSE 0 END)
        FROM   dbo.Direccion WITH (UPDLOCK, HOLDLOCK)
        WHERE  IDUsuario = @IDUsuarioActor;

        IF ISNULL(@EsPropia, 0) = 0
            THROW 50001, N'La dirección no existe.', 1;

        IF @EsPredeterminada = 1
            UPDATE dbo.Direccion
            SET    EsPredeterminada = 0, FechaActualizacion = SYSUTCDATETIME()
            WHERE  IDUsuario = @IDUsuarioActor AND EsPredeterminada = 1 AND IDDireccion <> @IDDireccion;

        UPDATE dbo.Direccion
        SET    Alias            = CASE WHEN @QuitarAlias = 1 THEN NULL ELSE COALESCE(@Alias, Alias) END,
               NombreRecibe     = COALESCE(@NombreRecibe, NombreRecibe),
               TelefonoRecibe   = COALESCE(@TelefonoRecibe, TelefonoRecibe),
               IDMunicipio      = COALESCE(@IDMunicipio, IDMunicipio),
               DireccionLinea   = COALESCE(@DireccionLinea, DireccionLinea),
               Referencia       = CASE WHEN @QuitarReferencia = 1 THEN NULL ELSE COALESCE(@Referencia, Referencia) END,
               EsPredeterminada = COALESCE(@EsPredeterminada, EsPredeterminada),
               FechaActualizacion = SYSUTCDATETIME()
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
