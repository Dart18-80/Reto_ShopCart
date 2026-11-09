-- N-09: si el Admin puede reintentar un reembolso ahora: un Fallido, o un Pendiente que nadie tiene tomado o cuyo
-- próximo intento ya llegó (uno con reclamo vigente lo está procesando otro). Una sola regla para
-- SP_Pedidos_ReintentarReembolso, que la exige al actualizar, y SP_Pedidos_ListarReembolsos, que la ofrece (M8-H05).
CREATE OR ALTER FUNCTION dbo.FU_Pedidos_ReembolsoReintentable
    (@Estado VARCHAR(14), @TokenReclamo UNIQUEIDENTIFIER, @FechaProximoIntento DATETIME2(3))
RETURNS TABLE
AS
RETURN
    SELECT CONVERT(BIT, IIF(@Estado = 'Fallido'
                            OR (@Estado = 'Pendiente'
                                AND (@TokenReclamo IS NULL OR @FechaProximoIntento <= SYSUTCDATETIME())), 1, 0))
               AS PuedeReintentar;
GO
