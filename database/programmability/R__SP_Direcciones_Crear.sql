-- N-17: el cliente de la petición agrega una dirección (máximo 10). Si es la predeterminada, la anterior
-- deja de serlo en la misma transacción. Devuelve la dirección creada.
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Crear
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

    -- E2-H05: tope de direcciones por cliente.
    DECLARE @MaximoDirecciones INT = 10, @IDDireccion INT;

    IF NOT EXISTS (SELECT 1 FROM dbo.Municipio WHERE IDMunicipio = @IDMunicipio)
        THROW 50003, N'El municipio no existe.', 1;

    BEGIN TRY
        BEGIN TRAN;

        -- UPDLOCK + HOLDLOCK: dos altas simultáneas del mismo cliente no superan el tope.
        IF (SELECT COUNT(*) FROM dbo.Direccion WITH (UPDLOCK, HOLDLOCK) WHERE IDUsuario = @IDUsuarioActor)
           >= @MaximoDirecciones
            THROW 50106, N'Alcanzaste el máximo de 10 direcciones. Elimina una para agregar otra.', 1;

        IF @EsPredeterminada = 1
            UPDATE dbo.Direccion
            SET    EsPredeterminada = 0, FechaActualizacion = SYSUTCDATETIME()
            WHERE  IDUsuario = @IDUsuarioActor AND EsPredeterminada = 1;

        INSERT INTO dbo.Direccion (IDUsuario, Alias, NombreRecibe, TelefonoRecibe, IDMunicipio, DireccionLinea,
                                   Referencia, EsPredeterminada)
        VALUES (@IDUsuarioActor, @Alias, @NombreRecibe, @TelefonoRecibe, @IDMunicipio, @DireccionLinea,
                @Referencia, @EsPredeterminada);
        SET @IDDireccion = SCOPE_IDENTITY();

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Direcciones_Listar @IDDireccion = @IDDireccion, @IDUsuarioActor = @IDUsuarioActor;
END
GO
