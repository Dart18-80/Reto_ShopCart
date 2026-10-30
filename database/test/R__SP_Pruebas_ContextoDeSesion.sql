-- Solo existe en shopcart_test: establece el contexto como lo haría un SP que escribe y devuelve lo
-- que un trigger leería de SESSION_CONTEXT (A-18).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_ContextoDeSesion
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    SELECT  TRY_CONVERT(INT, SESSION_CONTEXT(N'IDUsuario'))              AS IDUsuario,
            TRY_CONVERT(VARCHAR(20), SESSION_CONTEXT(N'Rol'))            AS Rol,
            TRY_CONVERT(UNIQUEIDENTIFIER, SESSION_CONTEXT(N'RequestId')) AS RequestId;
END
GO
