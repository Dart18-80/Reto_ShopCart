-- Solo existe en shopcart_test: crea un cupón de monto fijo con código único y el límite indicado.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CrearCupon
    @LimiteUsosTotal INT,
    @IDUsuarioActor  INT              = NULL,
    @RolActor        VARCHAR(20)      = NULL,
    @RequestId       UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- A-18: los triggers de bitácora exigen el contexto (en una prueba sin petición, Rol = 'Sistema').
    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    INSERT INTO dbo.Cupon (Codigo, Descripcion, Tipo, Valor, FechaInicio, FechaFin, LimiteUsosTotal, LimiteUsosPorCliente)
    VALUES ('PRUEBA' + LEFT(REPLACE(CONVERT(VARCHAR(36), NEWID()), '-', ''), 20), N'Cupón de prueba', 'MontoFijo',
            10, SYSUTCDATETIME(), DATEADD(DAY, 30, SYSUTCDATETIME()), @LimiteUsosTotal, 1);

    SELECT CONVERT(INT, SCOPE_IDENTITY()) AS IDCupon;
END
GO
