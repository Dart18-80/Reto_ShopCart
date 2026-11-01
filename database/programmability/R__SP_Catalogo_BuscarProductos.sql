-- RF-02, A-10, RNF-1: búsqueda pública del catálogo sobre VW_Catalogo_ProductosTienda (activos, con al
-- menos una variante activa con precio vigente). Filtros opcionales de texto (sin mayúsculas ni tildes, con
-- los comodines del usuario escapados por FU_Catalogo_PatronBusqueda), categoría, rango de precio y
-- disponibilidad; orden de una lista blanca resuelto con CASE; paginación.
-- Orden: relevancia (por defecto; primero lo que empieza con el texto y sin texto equivale a nombre
-- ascendente), precio (el menor precio vigente entre las variantes activas), nombre o recientes
-- (FechaCreacion descendente; no usa la dirección); dirección asc (por defecto) o desc. Todo orden termina con IDProducto, así OFFSET no repite ni pierde productos.
-- SQL dinámico (sqlserver-sp §11): solo se concatenan fragmentos constantes; todo valor viaja como
-- parámetro de sp_executesql. A-23: corre como shopcart_busqueda, que solo puede leer la vista; por eso
-- el SQL dinámico no llama funciones ni lee tablas (los patrones se calculan antes, fuera de él).
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_BuscarProductos
    @Texto          NVARCHAR(150),
    @IDCategoria    INT,
    @PrecioMin      DECIMAL(12,2),
    @PrecioMax      DECIMAL(12,2),
    @Disponible     BIT,
    @Orden          VARCHAR(20),
    @Direccion      VARCHAR(4),
    @Pagina         INT,
    @Tamano         INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
WITH EXECUTE AS 'shopcart_busqueda'
AS
BEGIN
    SET NOCOUNT ON;

    -- Solo lectura: sin transacción ni contexto de actor (A-18 solo lo exige a los SPs que escriben).
    IF @Orden IS NULL OR @Orden NOT IN ('relevancia', 'precio', 'nombre', 'recientes')
       OR @Direccion IS NULL OR @Direccion NOT IN ('asc', 'desc')
        THROW 50003, N'El ordenamiento no es válido.', 1;
    IF @Pagina IS NULL OR @Tamano IS NULL OR @Pagina < 1 OR @Tamano NOT BETWEEN 1 AND 100
        THROW 50003, N'Los parámetros de paginación no son válidos.', 1;
    IF @PrecioMin > @PrecioMax
        THROW 50003, N'El precio mínimo no puede ser mayor que el máximo.', 1;

    DECLARE @Contiene NVARCHAR(400), @EmpiezaCon NVARCHAR(400);
    SELECT @Contiene = f.Contiene, @EmpiezaCon = f.EmpiezaCon
    FROM   dbo.FU_Catalogo_PatronBusqueda(@Texto) AS f;

    DECLARE @Filtro NVARCHAR(MAX) = N'
FROM   dbo.VW_Catalogo_ProductosTienda AS p
WHERE  1 = 1';

    IF @Texto       IS NOT NULL SET @Filtro += N' AND p.NombreBusqueda LIKE @Contiene ESCAPE N''\''';
    IF @IDCategoria IS NOT NULL SET @Filtro += N' AND p.IDCategoria = @IDCategoria';
    IF @PrecioMin   IS NOT NULL SET @Filtro += N' AND p.PrecioMinimo >= @PrecioMin';
    IF @PrecioMax   IS NOT NULL SET @Filtro += N' AND p.PrecioMinimo <= @PrecioMax';
    IF @Disponible  IS NOT NULL SET @Filtro += N' AND p.TieneDisponible = @Disponible';

    -- sqlserver-sp §5: dos conjuntos, la página y el total del filtro (real aunque la página esté vacía).
    DECLARE @Sql NVARCHAR(MAX) = N'
SELECT p.IDProducto, p.Nombre, p.IDCategoria, p.Categoria, p.PrecioMinimo, p.TieneDisponible,
       p.ImagenPrincipal' + @Filtro + N'
ORDER BY
    CASE WHEN @Orden = ''relevancia'' AND @EmpiezaCon IS NOT NULL
         THEN CASE WHEN p.NombreBusqueda LIKE @EmpiezaCon ESCAPE N''\'' THEN 0 ELSE 1 END END,
    CASE WHEN @Orden = ''precio''    AND @Direccion = ''asc''  THEN p.PrecioMinimo END ASC,
    CASE WHEN @Orden = ''precio''    AND @Direccion = ''desc'' THEN p.PrecioMinimo END DESC,
    CASE WHEN @Orden = ''recientes'' THEN p.FechaCreacion END DESC,
    CASE WHEN @Orden = ''recientes'' THEN p.IDProducto END DESC,
    CASE WHEN @Orden = ''nombre''    AND @Direccion = ''desc'' THEN p.Nombre END DESC,
    p.Nombre,
    p.IDProducto
OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
SELECT COUNT(*) AS Total' + @Filtro + N';';

    EXEC sys.sp_executesql @Sql,
         N'@Contiene NVARCHAR(400), @EmpiezaCon NVARCHAR(400), @IDCategoria INT, @PrecioMin DECIMAL(12,2),
           @PrecioMax DECIMAL(12,2), @Disponible BIT, @Orden VARCHAR(20), @Direccion VARCHAR(4),
           @Pagina INT, @Tamano INT',
         @Contiene = @Contiene, @EmpiezaCon = @EmpiezaCon, @IDCategoria = @IDCategoria,
         @PrecioMin = @PrecioMin, @PrecioMax = @PrecioMax, @Disponible = @Disponible, @Orden = @Orden,
         @Direccion = @Direccion, @Pagina = @Pagina, @Tamano = @Tamano;
END
GO
