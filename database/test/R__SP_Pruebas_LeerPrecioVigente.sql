-- Solo existe en shopcart_test: lo que devuelve FU_Catalogo_PrecioVigente para una variante.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_LeerPrecioVigente
    @IDVariante     INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT pv.IDPrecioVariante, pv.Precio
    FROM   dbo.FU_Catalogo_PrecioVigente(@IDVariante) AS pv;
END
GO
