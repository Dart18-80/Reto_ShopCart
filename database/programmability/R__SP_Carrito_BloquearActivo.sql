-- Interno (sqlserver-sp §7): bloquea el carrito Activo del cliente (@IDUsuario) o, si no hay cliente, el
-- del invitado (@HashTokenInvitado). @IDCarrito queda en NULL si no existe. Es el primer bloqueo de todo SP
-- de carrito (01 §6.6: carrito → variantes en orden de IDVariante).
-- HOLDLOCK bloquea también el hueco del índice único filtrado: dos primeras altas del mismo cliente se
-- serializan aquí y la segunda encuentra el carrito que creó la primera. Los predicados repiten el filtro
-- de cada índice para que el optimizador lo use (y bloquee solo esa llave, no la tabla).
CREATE OR ALTER PROCEDURE dbo.SP_Carrito_BloquearActivo
    @IDUsuario         INT,
    @HashTokenInvitado BINARY(32),
    @IDCarrito         INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    IF @@TRANCOUNT = 0
        THROW 50005, N'SP_Carrito_BloquearActivo debe ejecutarse dentro de una transacción.', 1;

    SET @IDCarrito = NULL;

    IF @IDUsuario IS NOT NULL
        SELECT @IDCarrito = c.IDCarrito
        FROM   dbo.Carrito AS c WITH (UPDLOCK, HOLDLOCK)
        WHERE  c.IDUsuario = @IDUsuario AND c.IDUsuario IS NOT NULL AND c.Estado = 'Activo';
    ELSE IF @HashTokenInvitado IS NOT NULL
        SELECT @IDCarrito = c.IDCarrito
        FROM   dbo.Carrito AS c WITH (UPDLOCK, HOLDLOCK)
        WHERE  c.HashTokenInvitado = @HashTokenInvitado AND c.HashTokenInvitado IS NOT NULL
          AND  c.Estado = 'Activo';
END
GO
