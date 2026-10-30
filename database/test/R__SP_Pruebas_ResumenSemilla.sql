-- Solo existe en shopcart_test: resume lo que dejaron las semillas S001–S004. El catálogo demo se
-- reconoce por sus categorías; las pruebas crean las suyas con nombres únicos y no cuentan aquí.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_ResumenSemilla
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @VariantesDemo TABLE (IDVariante INT PRIMARY KEY, IDProducto INT, SKU VARCHAR(40), ExistenciaFisica INT);
    INSERT INTO @VariantesDemo (IDVariante, IDProducto, SKU, ExistenciaFisica)
    SELECT v.IDVariante, v.IDProducto, v.SKU, v.ExistenciaFisica
    FROM   dbo.Variante  AS v
    JOIN   dbo.Producto  AS p ON p.IDProducto = v.IDProducto
    JOIN   dbo.Categoria AS c ON c.IDCategoria = p.IDCategoria
    WHERE  c.Nombre IN (N'Camisas y blusas', N'Pantalones', N'Vestidos y faldas', N'Chaquetas y suéteres',
                        N'Calzado', N'Ropa deportiva', N'Accesorios', N'Infantil');

    SELECT
        (SELECT COUNT(*) FROM dbo.Departamento) AS Departamentos,
        (SELECT COUNT(*) FROM dbo.Municipio)    AS Municipios,
        (SELECT COUNT(*) FROM dbo.Departamento AS d
         WHERE NOT EXISTS (SELECT 1 FROM dbo.Municipio AS m WHERE m.IDDepartamento = d.IDDepartamento)) AS DepartamentosSinMunicipios,
        (SELECT COUNT(*) FROM dbo.Rol)                    AS Roles,
        (SELECT COUNT(*) FROM dbo.EstadoPedido)           AS EstadosPedido,
        (SELECT COUNT(*) FROM dbo.TransicionEstadoPedido) AS Transiciones,
        (SELECT COUNT(*) FROM dbo.TipoMovimiento)         AS TiposMovimiento,
        (SELECT COUNT(*) FROM dbo.MetodoEnvio)            AS MetodosEnvio,
        (SELECT COUNT(*) FROM dbo.ParametroSistema)       AS ParametrosSistema,
        (SELECT COUNT(*) FROM dbo.Usuario
         WHERE CorreoNormalizado IN (N'admin@shopcart.gt', N'operador@shopcart.gt',
                                     N'cliente@shopcart.gt', N'cliente2@shopcart.gt')) AS UsuariosDemo,
        (SELECT COUNT(DISTINCT IDProducto) FROM @VariantesDemo) AS ProductosDemo,
        (SELECT COUNT(*) FROM dbo.Producto AS p
         WHERE p.Activo = 0 AND p.IDProducto IN (SELECT IDProducto FROM @VariantesDemo)) AS ProductosInactivos,
        (SELECT COUNT(*) FROM @VariantesDemo)                         AS VariantesDemo,
        (SELECT COUNT(*) FROM @VariantesDemo WHERE ExistenciaFisica = 0) AS VariantesSinExistencia,
        (SELECT COUNT(*) FROM @VariantesDemo WHERE ExistenciaFisica = 1) AS VariantesConUnaUnidad,
        (SELECT MAX(SKU) FROM @VariantesDemo WHERE ExistenciaFisica = 1) AS SKUConUnaUnidad,
        (SELECT COUNT(*) FROM @VariantesDemo AS v
         WHERE (SELECT COUNT(*) FROM dbo.PrecioVariante AS pv WHERE pv.IDVariante = v.IDVariante) > 1) AS VariantesConHistorialPrecio,
        (SELECT MIN(pv.Precio) FROM @VariantesDemo AS v CROSS APPLY dbo.FU_Catalogo_PrecioVigente(v.IDVariante) AS pv) AS PrecioMinimo,
        (SELECT MAX(pv.Precio) FROM @VariantesDemo AS v CROSS APPLY dbo.FU_Catalogo_PrecioVigente(v.IDVariante) AS pv) AS PrecioMaximo,
        (SELECT COUNT(DISTINCT v.IDProducto) FROM @VariantesDemo AS v
         WHERE NOT EXISTS (SELECT 1 FROM dbo.ImagenProducto AS i
                           WHERE i.IDProducto = v.IDProducto AND i.EsPrincipal = 1)) AS ProductosSinImagenPrincipal,
        (SELECT COUNT(*) FROM dbo.VW_Inventario_Conciliacion AS c
         WHERE c.IDVariante IN (SELECT IDVariante FROM @VariantesDemo)) AS VariantesDescuadradas;
END
GO
