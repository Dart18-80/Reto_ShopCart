-- N-17: los municipios de un departamento, en orden alfabético. Un departamento inexistente responde 50001.
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_ListarMunicipios
    @IDDepartamento INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Departamento WHERE IDDepartamento = @IDDepartamento)
        THROW 50001, N'El departamento no existe.', 1;

    SELECT IDMunicipio, Nombre FROM dbo.Municipio WHERE IDDepartamento = @IDDepartamento ORDER BY Nombre;
END
GO
