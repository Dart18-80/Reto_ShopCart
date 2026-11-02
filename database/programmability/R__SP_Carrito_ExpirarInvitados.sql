-- Job (A-04, N-05): cada hora, los carritos de invitado Activo con DiasExpiracionCarritoInvitado días sin
-- actividad pasan a Expirado (sin borrado físico). Su cookie queda obsoleta: el siguiente producto crea otro
-- carrito con otro token. Un carrito de invitado nunca tiene sesión de checkout ni reservas (el checkout
-- exige sesión), así que no hay nada que liberar. Idempotente.
-- sp_getapplock: si la otra réplica lo está ejecutando, retorna sin hacer nada (Ejecutada = 0).
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_ExpirarInvitados
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @Bloqueo INT, @Expirados INT, @Dias SMALLINT =
        (SELECT TOP (1) ps.DiasExpiracionCarritoInvitado FROM dbo.ParametroSistema AS ps
         ORDER BY ps.IDParametroSistema);

    BEGIN TRY
        BEGIN TRAN;

        EXEC @Bloqueo = sys.sp_getapplock @Resource = N'Job_Carrito_ExpirarInvitados', @LockMode = N'Exclusive',
                                          @LockOwner = N'Transaction', @LockTimeout = 0;
        IF @Bloqueo < 0
        BEGIN
            ROLLBACK;
            SELECT CONVERT(BIT, 0) AS Ejecutada, 0 AS CarritosExpirados;
            RETURN;
        END

        -- IX_Carrito_Abandono (Estado, FechaUltimaActividad).
        UPDATE dbo.Carrito
        SET    Estado = 'Expirado', FechaCierre = SYSUTCDATETIME()
        WHERE  Estado = 'Activo' AND IDUsuario IS NULL
          AND  FechaUltimaActividad < DATEADD(DAY, -@Dias, SYSUTCDATETIME());
        SET @Expirados = @@ROWCOUNT;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT CONVERT(BIT, 1) AS Ejecutada, @Expirados AS CarritosExpirados;
END
GO
