-- Solo existe en shopcart_test: devuelve los parámetros estándar que recibió (A-18).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_EcoContexto
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    SELECT  @IDUsuarioActor AS IDUsuarioActor,
            @RolActor       AS RolActor,
            @RequestId      AS RequestId;
END
GO
