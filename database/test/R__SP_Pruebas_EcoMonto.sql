-- Solo existe en shopcart_test: devuelve el monto recibido y un promedio con decimales periódicos
-- (1.00, 2.00, 2.00 → 1.666…), convertido a DECIMAL(15,2) como exige A-21 para todo agregado de montos.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_EcoMonto
    @Monto          DECIMAL(12,2),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT  @Monto AS Monto,
            (SELECT CONVERT(DECIMAL(15,2), AVG(m.Valor))
             FROM (VALUES (CONVERT(DECIMAL(12,2), 1.00)), (2.00), (2.00)) AS m (Valor)) AS Promedio;
END
GO
