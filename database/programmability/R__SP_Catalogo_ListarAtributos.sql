-- N-14: atributos con sus valores (Admin), una fila por valor; un atributo sin valores sale una vez con el
-- valor en NULL. Ordenados por el orden del atributo y después por el del valor.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_ListarAtributos
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT a.IDAtributo, a.Nombre, a.Orden,
           v.IDValorAtributo, v.Valor, v.Orden AS OrdenValor
    FROM   dbo.Atributo AS a
    LEFT JOIN dbo.ValorAtributo AS v ON v.IDAtributo = a.IDAtributo
    ORDER BY a.Orden, a.Nombre, a.IDAtributo, v.Orden, v.Valor, v.IDValorAtributo;
END
GO
