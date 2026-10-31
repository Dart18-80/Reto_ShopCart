-- N-17: los 22 departamentos de Guatemala, en orden alfabético.
CREATE OR ALTER PROCEDURE dbo.SP_Direcciones_ListarDepartamentos
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT IDDepartamento, Nombre FROM dbo.Departamento ORDER BY Nombre;
END
GO
