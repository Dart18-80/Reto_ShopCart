-- Solo existe en shopcart_test: permite probar el mapeo de errores de negocio (A-06, A-19) sin SQL en las pruebas.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_LanzarError
    @Numero         INT,
    @Mensaje        NVARCHAR(2048),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Numero NOT BETWEEN 50000 AND 59999
        THROW 50003, N'Solo se pueden lanzar errores de negocio (50000–59999).', 1;

    THROW @Numero, @Mensaje, 1;
END
GO
