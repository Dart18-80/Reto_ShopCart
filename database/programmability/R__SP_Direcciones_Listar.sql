-- RF-01: las direcciones del cliente de la petición (@IDUsuarioActor, del token), la predeterminada
-- primero. Con @IDDireccion devuelve solo esa, si es suya (una ajena no aparece: la API responde 404).
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_Listar
    @IDDireccion    INT              = NULL,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT d.IDDireccion, d.Alias, d.NombreRecibe, d.TelefonoRecibe, d.IDMunicipio, m.Nombre AS Municipio,
           m.IDDepartamento, dep.Nombre AS Departamento, d.DireccionLinea, d.Referencia, d.EsPredeterminada
    FROM   dbo.Direccion    AS d
    JOIN   dbo.Municipio    AS m   ON m.IDMunicipio = d.IDMunicipio
    JOIN   dbo.Departamento AS dep ON dep.IDDepartamento = m.IDDepartamento
    WHERE  d.IDUsuario = @IDUsuarioActor
      AND  (@IDDireccion IS NULL OR d.IDDireccion = @IDDireccion)
    ORDER BY d.EsPredeterminada DESC, d.IDDireccion;
END
GO
