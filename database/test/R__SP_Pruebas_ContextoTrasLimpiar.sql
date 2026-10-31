-- Solo existe en shopcart_test: en una misma sesión fija un actor y después llama a
-- SP_Sistema_EstablecerContexto sin actor, como pasa cuando el pool reutiliza la conexión de una
-- petición para un job. Devuelve lo que un trigger leería después (A-18).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_ContextoTrasLimpiar
    @IDUsuarioAnterior INT,
    @RolAnterior       VARCHAR(20),
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @RequestIdAnterior UNIQUEIDENTIFIER = NEWID();
    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioAnterior, @RolAnterior, @RequestIdAnterior;
    EXEC dbo.SP_Sistema_EstablecerContexto NULL, NULL, NULL;

    SELECT  TRY_CONVERT(INT, SESSION_CONTEXT(N'IDUsuario'))              AS IDUsuario,
            TRY_CONVERT(VARCHAR(20), SESSION_CONTEXT(N'Rol'))            AS Rol,
            TRY_CONVERT(UNIQUEIDENTIFIER, SESSION_CONTEXT(N'RequestId')) AS RequestId;
END
GO
