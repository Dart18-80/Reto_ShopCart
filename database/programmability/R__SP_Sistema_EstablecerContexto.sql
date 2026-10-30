-- A-18: deja al actor de la petición en SESSION_CONTEXT para que los triggers (bitácora y
-- transiciones) sepan quién actúa. Todo SP que escribe lo llama como primera instrucción.
CREATE OR ALTER PROCEDURE dbo.SP_Sistema_EstablecerContexto
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Se fija en cada llamada, también con NULL: las conexiones del pool se reutilizan y el
    -- contexto de la petición anterior seguiría ahí.
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioActor;
    EXEC sys.sp_set_session_context @key = N'Rol',       @value = @RolActor;
    EXEC sys.sp_set_session_context @key = N'RequestId', @value = @RequestId;
END
GO
