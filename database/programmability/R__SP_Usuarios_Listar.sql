-- N-15: listado de usuarios para el Admin, paginado en el servidor y filtrado por rol y estado
-- (NULL = sin filtro). TotalFilas lleva el total para la paginación.
CREATE OR ALTER PROCEDURE dbo.SP_Usuarios_Listar
    @Pagina         INT,
    @Tamano         INT,
    @Rol            VARCHAR(20),
    @Activo         BIT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Pagina < 1 OR @Tamano NOT BETWEEN 1 AND 100
        THROW 50003, N'La página o el tamaño no son válidos.', 1;

    SELECT u.IDUsuario, u.Correo, u.Nombre, u.Telefono, r.Codigo AS Rol, u.Activo,
           COUNT(*) OVER () AS TotalFilas
    FROM   dbo.Usuario AS u
    JOIN   dbo.Rol     AS r ON r.IDRol = u.IDRol
    WHERE  (@Rol IS NULL OR r.Codigo = @Rol)
      AND  (@Activo IS NULL OR u.Activo = @Activo)
    ORDER BY u.IDUsuario
    OFFSET (@Pagina - 1) * @Tamano ROWS FETCH NEXT @Tamano ROWS ONLY;
END
GO
