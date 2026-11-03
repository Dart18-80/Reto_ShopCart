-- N-09: los reembolsos para el Admin, los más recientes primero, opcionalmente por estado (Fallido es la lista
-- de los que se resuelven a mano). Un cobro sin pedido (E9-H04) trae su intento en lugar del pedido. Dos
-- conjuntos (sqlserver-sp §5): la página y el total del filtro.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ListarReembolsos
    @Estado         VARCHAR(14)      = NULL,
    @Pagina         INT              = 1,
    @Tamano         INT              = 20,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @RolActor IS NULL OR @RolActor <> 'Administrador'
        THROW 50005, N'Solo el Administrador consulta los reembolsos.', 1;
    IF @Pagina < 1 OR @Tamano NOT BETWEEN 1 AND 100
        THROW 50003, N'Los parámetros de paginación no son válidos.', 1;

    SELECT r.IDReembolso, r.IDPedido, p.NumeroPedido, r.IDIntentoPago, r.IDDevolucion, r.Origen, r.Monto, r.Estado,
           r.Intentos, r.UltimoError, r.IDTransaccionReembolso, r.FechaProximoIntento, r.FechaCompletado,
           r.FechaCreacion, r.MotivoResolucion, r.ReferenciaResolucion, r.FechaResolucion
    FROM   dbo.Reembolso AS r
    LEFT JOIN dbo.Pedido AS p ON p.IDPedido = r.IDPedido
    WHERE  @Estado IS NULL OR r.Estado = @Estado
    ORDER BY r.FechaCreacion DESC, r.IDReembolso DESC
    OFFSET (@Pagina - 1) * @Tamano ROWS
    FETCH NEXT @Tamano ROWS ONLY;

    SELECT COUNT(*) AS Total FROM dbo.Reembolso AS r WHERE @Estado IS NULL OR r.Estado = @Estado;
END
GO
