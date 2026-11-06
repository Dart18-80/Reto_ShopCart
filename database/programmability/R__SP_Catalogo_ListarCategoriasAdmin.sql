-- RF-02, N-14 (M6-H02): todas las categorías para el Admin, activas o no (para poder reactivarlas), con su
-- ilustración y cuántos productos tienen, por nombre. Son pocas: sin paginar. No escribe.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ListarCategoriasAdmin
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT c.IDCategoria, c.Nombre, c.Descripcion, c.Ilustracion, c.Activo,
           (SELECT COUNT(*) FROM dbo.Producto AS p WHERE p.IDCategoria = c.IDCategoria) AS Productos
    FROM   dbo.Categoria AS c
    ORDER BY c.Nombre, c.IDCategoria;
END
GO
