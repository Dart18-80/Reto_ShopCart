-- N-05: el carrito Activo de quien pide, sin bloqueo: el del cliente (@IDCliente) o, si no hay cliente, el
-- del invitado (@HashTokenInvitado). Ninguna fila si no tiene. Los predicados repiten el filtro de cada
-- índice único filtrado para que el optimizador lo use. Los SPs que escriben bloquean con
-- SP_Carrito_BloquearActivo.
CREATE OR ALTER FUNCTION dbo.FU_Carrito_Activo (@IDCliente INT, @HashTokenInvitado BINARY(32))
RETURNS TABLE
AS
RETURN
    SELECT c.IDCarrito, c.IDCupon
    FROM   dbo.Carrito AS c
    WHERE  @IDCliente IS NOT NULL
      AND  c.IDUsuario = @IDCliente AND c.IDUsuario IS NOT NULL AND c.Estado = 'Activo'
    UNION ALL
    SELECT c.IDCarrito, c.IDCupon
    FROM   dbo.Carrito AS c
    WHERE  @IDCliente IS NULL
      AND  c.HashTokenInvitado = @HashTokenInvitado AND c.HashTokenInvitado IS NOT NULL AND c.Estado = 'Activo';
GO
