-- N-02, RF-02: historial de precios de una variante (Admin), de la versión más reciente a la más antigua,
-- con quién hizo cada cambio. Sale de PrecioVariante (IX_PrecioVariante_Historial), no de la bitácora.
CREATE OR ALTER PROCEDURE dbo.SP_Catalogo_HistorialPrecios
    @IDVariante     INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Variante WHERE IDVariante = @IDVariante)
        THROW 50001, N'La variante no existe.', 1;

    SELECT pv.IDPrecioVariante, pv.Precio, pv.VigenteDesde, pv.VigenteHasta, pv.IDUsuario, u.Nombre AS Usuario
    FROM   dbo.PrecioVariante AS pv
    JOIN   dbo.Usuario        AS u ON u.IDUsuario = pv.IDUsuario
    WHERE  pv.IDVariante = @IDVariante
    ORDER BY pv.VigenteDesde DESC, pv.IDPrecioVariante DESC;
END
GO
