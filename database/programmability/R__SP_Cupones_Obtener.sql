-- RF-05: un cupón para el Admin (VW_Cupones_Admin). Si no existe, ninguna fila (la API responde 404).
CREATE OR ALTER PROCEDURE dbo.SP_Cupones_Obtener
    @IDCupon        INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT c.IDCupon, c.Codigo, c.Descripcion, c.Tipo, c.Valor, c.MontoMaximoDescuento, c.MontoMinimoCompra,
           c.IDCategoria, c.Categoria, c.FechaInicio, c.FechaFin, c.LimiteUsosTotal, c.LimiteUsosPorCliente,
           c.UsosComprometidos, c.Usado, c.Activo
    FROM   dbo.VW_Cupones_Admin AS c
    WHERE  c.IDCupon = @IDCupon;
END
GO
