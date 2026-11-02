-- Solo existe en shopcart_test: las reservas de una sesión de checkout, para comprobar el todo o nada y la
-- liberación (N-06).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_LeerReservasSesion
    @IDSesionCheckout INT,
    @IDUsuarioActor   INT              = NULL,
    @RolActor         VARCHAR(20)      = NULL,
    @RequestId        UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT r.IDVariante, r.Cantidad, r.Estado
    FROM   dbo.Reserva AS r
    WHERE  r.IDSesionCheckout = @IDSesionCheckout
    ORDER BY r.IDVariante;
END
GO
