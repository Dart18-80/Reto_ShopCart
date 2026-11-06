-- N-15: listado de usuarios para el Admin, paginado en el servidor (M6-H01: @Orden nombre | correo | rol |
-- recientes y @Direccion; por defecto, los más recientes primero) y filtrado por rol y estado
-- (NULL = sin filtro). TotalFilas lleva el total para la paginación.
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Listar
    @Pagina         INT,
    @Tamano         INT,
    @Rol            VARCHAR(20),
    @Activo         BIT,
    @Orden          VARCHAR(20)      = 'recientes',
    @Direccion      VARCHAR(4)       = 'desc',
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 OR @Tamano NOT BETWEEN 1 AND 100
        THROW 50003, N'La página o el tamaño no son válidos.', 1;
    -- M6-H01 (A-10): el orden sale de una lista blanca; la API la valida con Zod y el SP la revalida (un NULL
    -- explícito no es «sin orden»).
    IF @Orden IS NULL OR @Direccion IS NULL
       OR @Orden NOT IN ('nombre', 'correo', 'rol', 'recientes') OR @Direccion NOT IN ('asc', 'desc')
        THROW 50003, N'El ordenamiento no es válido.', 1;

    -- sqlserver-sp §5: dos conjuntos, la página y el total del filtro. El total sale de su propia consulta,
    -- así es real aunque la página pedida esté vacía.
    SELECT u.IDUsuario, u.Correo, u.Nombre, u.Telefono, r.Codigo AS Rol, u.Activo
    FROM   dbo.Usuario AS u
    JOIN   dbo.Rol     AS r ON r.IDRol = u.IDRol
    WHERE  (@Rol IS NULL OR r.Codigo = @Rol)
      AND  (@Activo IS NULL OR u.Activo = @Activo)
    ORDER BY
        CASE WHEN @Orden = 'nombre' AND @Direccion = 'asc'  THEN u.Nombre END ASC,
        CASE WHEN @Orden = 'nombre' AND @Direccion = 'desc' THEN u.Nombre END DESC,
        CASE WHEN @Orden = 'correo' AND @Direccion = 'asc'  THEN u.Correo END ASC,
        CASE WHEN @Orden = 'correo' AND @Direccion = 'desc' THEN u.Correo END DESC,
        CASE WHEN @Orden = 'rol' AND @Direccion = 'asc'  THEN r.Codigo END ASC,
        CASE WHEN @Orden = 'rol' AND @Direccion = 'desc' THEN r.Codigo END DESC,
        CASE WHEN @Orden = 'recientes' AND @Direccion = 'asc'  THEN u.FechaCreacion END ASC,
        CASE WHEN @Orden = 'recientes' AND @Direccion = 'desc' THEN u.FechaCreacion END DESC,
        -- Desempate estable por la PK: dos páginas nunca repiten ni saltan filas.
        CASE WHEN @Direccion = 'asc'  THEN u.IDUsuario END ASC,
        CASE WHEN @Direccion = 'desc' THEN u.IDUsuario END DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY
    -- Con el orden como parámetro, cada combinación usa su propio plan (los CASE se resuelven al compilar).
    OPTION (RECOMPILE);

    SELECT COUNT(*) AS Total
    FROM   dbo.Usuario AS u
    JOIN   dbo.Rol     AS r ON r.IDRol = u.IDRol
    WHERE  (@Rol IS NULL OR r.Codigo = @Rol)
      AND  (@Activo IS NULL OR u.Activo = @Activo);
END
GO
