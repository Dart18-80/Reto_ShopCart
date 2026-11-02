-- Solo existe en shopcart_test: el día de Guatemala de una fecha UTC con FU_Sistema_FechaLocal (la misma que usa
-- SP_Pedidos_CrearPedido), para probar los pagos cerca de la medianoche sin depender del reloj (A-12).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_FechaLocal
    @FechaUtc       DATETIME2(3),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT CONVERT(VARCHAR(10), f.FechaLocal, 23) AS FechaLocal FROM dbo.FU_Sistema_FechaLocal(@FechaUtc) AS f;
END
GO
