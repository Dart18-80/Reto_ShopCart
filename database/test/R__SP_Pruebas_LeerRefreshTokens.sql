-- Solo existe en shopcart_test: los refresh tokens de un usuario, del más reciente al más antiguo.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_LeerRefreshTokens
    @IDUsuario      INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT t.IDFamilia, t.HashToken, t.FechaUso, t.FechaRevocacion, t.MotivoRevocacion, t.IP
    FROM   dbo.RefreshToken AS t
    WHERE  t.IDUsuario = @IDUsuario
    ORDER BY t.IDRefreshToken DESC;
END
GO
