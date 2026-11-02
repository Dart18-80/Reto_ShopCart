-- Solo existe en shopcart_test: el estado de una sesión de checkout, de sus reservas y del uso de su cupón,
-- con el contador del cupón y los rechazos de pago.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_LeerSesionCheckout
    @IDSesionCheckout INT,
    @IDUsuarioActor   INT              = NULL,
    @RolActor         VARCHAR(20)      = NULL,
    @RequestId        UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT s.Estado,
           s.IntentosRechazados,
           (SELECT TOP (1) r.Estado FROM dbo.Reserva AS r WHERE r.IDSesionCheckout = s.IDSesionCheckout) AS EstadoReserva,
           u.Estado            AS EstadoUsoCupon,
           c.UsosComprometidos AS UsosComprometidosCupon
    FROM   dbo.SesionCheckout AS s
    LEFT JOIN dbo.UsoCupon AS u ON u.IDSesionCheckout = s.IDSesionCheckout
    LEFT JOIN dbo.Cupon    AS c ON c.IDCupon = u.IDCupon
    WHERE  s.IDSesionCheckout = @IDSesionCheckout;
END
GO
