-- A-07: rotación del refresh token por familia con detección de reúso.
--   Token válido y no usado: se marca como usado y se registra el nuevo (@NuevoHash) en la misma familia.
--   Token ya usado (reúso, posible robo): se revoca TODA la familia y se lanza 50102.
--   Token inexistente, vencido, revocado o de un usuario inactivo: sin filas (la API responde 401).
-- Devuelve el usuario de la sesión cuando la rotación ocurre.
CREATE OR ALTER PROCEDURE dbo.SP_Auth_RotarRefreshToken
    @HashToken      BINARY(32),
    @NuevoHash      BINARY(32),
    @DiasVigencia   INT,
    @IP             VARCHAR(45),
    @UserAgent      NVARCHAR(300),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME(),
            @IDRefreshToken BIGINT, @IDUsuario INT, @IDFamilia UNIQUEIDENTIFIER,
            @FechaUso DATETIME2(3), @Vigente BIT = 0, @Reuso BIT = 0;

    BEGIN TRY
        BEGIN TRAN;

        -- UPDLOCK: dos refresh con el mismo token se serializan; el segundo ve FechaUso y es un reúso.
        SELECT @IDRefreshToken = t.IDRefreshToken, @IDUsuario = t.IDUsuario, @IDFamilia = t.IDFamilia,
               @FechaUso = t.FechaUso,
               @Vigente = CASE WHEN t.FechaRevocacion IS NULL AND t.FechaExpiracion > @Ahora AND u.Activo = 1
                               THEN 1 ELSE 0 END
        FROM   dbo.RefreshToken AS t WITH (UPDLOCK, ROWLOCK)
        JOIN   dbo.Usuario      AS u ON u.IDUsuario = t.IDUsuario
        WHERE  t.HashToken = @HashToken;

        IF @Vigente = 1 AND @FechaUso IS NOT NULL
        BEGIN
            UPDATE dbo.RefreshToken
            SET    FechaRevocacion = @Ahora, MotivoRevocacion = 'Reuso'
            WHERE  IDFamilia = @IDFamilia AND FechaRevocacion IS NULL;
            SET @Reuso = 1;
        END
        ELSE IF @Vigente = 1
        BEGIN
            UPDATE dbo.RefreshToken SET FechaUso = @Ahora WHERE IDRefreshToken = @IDRefreshToken;

            INSERT INTO dbo.RefreshToken (IDUsuario, IDFamilia, HashToken, FechaExpiracion, IP, UserAgent)
            VALUES (@IDUsuario, @IDFamilia, @NuevoHash, DATEADD(DAY, @DiasVigencia, @Ahora), @IP, @UserAgent);
        END

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    -- Después del COMMIT: la revocación de la familia queda aunque la petición termine en error.
    IF @Reuso = 1
        THROW 50102, N'La sesión ya no es válida. Inicia sesión de nuevo.', 1;

    IF @Vigente = 1
        SELECT u.IDUsuario, u.Correo, u.Nombre, r.Codigo AS Rol
        FROM   dbo.Usuario AS u
        JOIN   dbo.Rol     AS r ON r.IDRol = u.IDRol
        WHERE  u.IDUsuario = @IDUsuario;
END
GO
