-- Solo existe en shopcart_test: aplica a un usuario un cambio de una lista blanca ('Desactivar',
-- 'CambiarContrasena', 'CambiarRol'), para comprobar qué registra la bitácora de usuarios (RF-09).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CambiarUsuario
    @IDUsuario      INT,
    @Cambio         VARCHAR(20),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @Cambio NOT IN ('Desactivar', 'CambiarContrasena', 'CambiarRol')
        THROW 50003, N'Cambio no válido para la prueba.', 1;

    BEGIN TRY
        BEGIN TRAN;
        UPDATE dbo.Usuario
        SET    Activo             = CASE WHEN @Cambio = 'Desactivar' THEN 0 ELSE Activo END,
               FechaDesactivacion = CASE WHEN @Cambio = 'Desactivar' THEN SYSUTCDATETIME() ELSE FechaDesactivacion END,
               HashContrasena     = CASE WHEN @Cambio = 'CambiarContrasena' THEN 'otro-hash-de-prueba' ELSE HashContrasena END,
               IDRol              = CASE WHEN @Cambio = 'CambiarRol'
                                         THEN (SELECT IDRol FROM dbo.Rol WHERE Codigo = 'Operador') ELSE IDRol END,
               FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDUsuario = @IDUsuario;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
