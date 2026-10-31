-- Solo existe en shopcart_test: productos de VW_Catalogo_ProductosTienda cuyo NombreBusqueda cumple el
-- patrón LIKE recibido (A-10: sin distinguir mayúsculas ni tildes).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_BuscarProductosTienda
    @Patron         NVARCHAR(150),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT t.Nombre, t.PrecioMinimo, t.TieneDisponible
    FROM   dbo.VW_Catalogo_ProductosTienda AS t
    WHERE  t.NombreBusqueda LIKE @Patron
    ORDER BY t.Nombre;
END
GO
