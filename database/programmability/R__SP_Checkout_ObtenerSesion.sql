-- RF-06, RF-01: la sesión de pago Activa del cliente (@IDUsuarioActor). Sin sesión, ningún conjunto (la API
-- responde 404). Dos conjuntos: la sesión con sus montos congelados (M-04, N-02) y sus líneas.
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_ObtenerSesion
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @IDSesion INT = (SELECT s.IDSesionCheckout FROM dbo.SesionCheckout AS s
                             WHERE s.IDUsuario = @IDUsuarioActor AND s.Estado = 'Activa');
    IF @IDSesion IS NULL
        RETURN;

    SELECT s.IDSesionCheckout, s.Estado, s.FechaExpiracion, s.NombreRecibe, s.TelefonoRecibe, s.IDMunicipio,
           s.Municipio, s.Departamento, s.DireccionLinea, s.Referencia, s.IDMetodoEnvio, s.NombreMetodoEnvio,
           s.DiasMin, s.DiasMax, s.CodigoCupon, s.Subtotal, s.Descuento, s.CostoEnvio, s.Total,
           s.IntentosRechazados
    FROM   dbo.SesionCheckout AS s
    WHERE  s.IDSesionCheckout = @IDSesion;

    SELECT l.IDVariante, p.IDProducto, p.Nombre AS Producto, v.SKU, v.DescripcionAtributos, l.Cantidad,
           l.PrecioUnitario, l.DescuentoLinea, l.TotalLinea
    FROM   dbo.LineaSesionCheckout AS l
    JOIN   dbo.Variante AS v ON v.IDVariante = l.IDVariante
    JOIN   dbo.Producto AS p ON p.IDProducto = v.IDProducto
    WHERE  l.IDSesionCheckout = @IDSesion
    ORDER BY l.IDVariante;
END
GO
