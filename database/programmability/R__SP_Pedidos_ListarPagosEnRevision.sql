-- E9-H04: los pagos en revisión manual para el Admin, los más recientes primero (IX_IntentoPago_EnRevision). Con
-- pedido: su autorización ya no existía en la pasarela al conciliar; sin pedido: un cobro capturado que no llegó a
-- ser pedido. Dos conjuntos (sqlserver-sp §5): la página y el total. Solo el Administrador.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ListarPagosEnRevision
    @Pagina         INT              = 1,
    @Tamano         INT              = 20,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @RolActor IS NULL OR @RolActor <> 'Administrador'
        THROW 50005, N'Solo el Administrador consulta los pagos en revisión.', 1;
    IF @Pagina < 1 OR @Tamano NOT BETWEEN 1 AND 100
        THROW 50003, N'Los parámetros de paginación no son válidos.', 1;

    SELECT i.IDIntentoPago, p.IDPedido, p.NumeroPedido, u.IDUsuario AS IDCliente, u.Nombre AS NombreCliente,
           u.Correo AS CorreoCliente, i.Monto, i.IDTransaccionPasarela, i.MarcaTarjeta, i.UltimosDigitos,
           IIF(p.IDPedido IS NULL, 'CobroSinPedido', 'AutorizacionInexistente') AS Causa,
           i.FechaActualizacion AS Fecha
    FROM   dbo.IntentoPago AS i
    JOIN   dbo.SesionCheckout AS s ON s.IDSesionCheckout = i.IDSesionCheckout
    JOIN   dbo.Usuario AS u ON u.IDUsuario = s.IDUsuario
    LEFT JOIN dbo.Pedido AS p ON p.IDIntentoPago = i.IDIntentoPago
    WHERE  i.Estado = 'EnRevision'
    ORDER BY i.FechaActualizacion DESC, i.IDIntentoPago DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS
    FETCH NEXT @Tamano ROWS ONLY;

    SELECT COUNT(*) AS Total FROM dbo.IntentoPago AS i WHERE i.Estado = 'EnRevision';
END
GO
