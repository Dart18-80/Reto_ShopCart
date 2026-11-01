-- RF-02: categorías activas de la tienda (público), por nombre.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ListarCategorias
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT c.IDCategoria, c.Nombre, c.Descripcion
    FROM   dbo.Categoria AS c
    WHERE  c.Activo = 1
    ORDER BY c.Nombre, c.IDCategoria;
END
GO
