-- Solo existe en shopcart_test: los carritos de un cliente o los que tienen un hash de invitado dado, con
-- su número de líneas, para comprobar que hay un solo carrito activo y que la base guarda el hash del
-- token y no el token.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_LeerCarritos
    @IDUsuario         INT              = NULL,
    @HashTokenInvitado BINARY(32)       = NULL,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT c.IDCarrito, c.Estado, c.IDUsuario,
           (SELECT COUNT(*) FROM dbo.LineaCarrito AS l WHERE l.IDCarrito = c.IDCarrito) AS Lineas
    FROM   dbo.Carrito AS c
    WHERE  c.IDUsuario = @IDUsuario OR c.HashTokenInvitado = @HashTokenInvitado
    ORDER BY c.IDCarrito;
END
GO
