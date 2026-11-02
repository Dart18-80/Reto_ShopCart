-- N-09 (plan E6-H03 §3): toma un reembolso Pendiente para devolver el dinero en la pasarela. Lo arrienda
-- @SegundosReclamo (FechaProximoIntento): mientras tanto, otro proceso (el job o el Admin) no lo toma. Si no
-- está Pendiente o ya lo tiene otro, no devuelve filas. Lo llaman la petición que canceló o devolvió (el
-- Cliente dueño, el Operador o el Admin) y el job (Sistema).
-- Devuelve lo que necesita la pasarela: la llave del reembolso, el monto, la transacción y la llave del intento.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_TomarReembolso
    @IDReembolso     INT,
    @SegundosReclamo INT,
    @IDUsuarioActor  INT              = NULL,
    @RolActor        VARCHAR(20)      = NULL,
    @RequestId       UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor NOT IN ('Cliente', 'Operador', 'Administrador', 'Sistema')
        THROW 50005, N'Rol no válido para procesar un reembolso.', 1;
    IF @SegundosReclamo IS NULL OR @SegundosReclamo <= 0
        THROW 50005, N'SP_Pedidos_TomarReembolso recibió un reclamo inválido.', 1;

    DECLARE @Tomado BIT = 0;

    BEGIN TRY
        BEGIN TRAN;

        UPDATE r
        SET    r.FechaProximoIntento = DATEADD(SECOND, @SegundosReclamo, SYSUTCDATETIME()),
               r.TokenReclamo = NEWID(), r.FechaActualizacion = SYSUTCDATETIME()
        FROM   dbo.Reembolso AS r WITH (UPDLOCK, ROWLOCK)
        JOIN   dbo.Pedido AS p ON p.IDPedido = r.IDPedido
        WHERE  r.IDReembolso = @IDReembolso AND r.Estado = 'Pendiente'
          AND  (r.FechaProximoIntento IS NULL OR r.FechaProximoIntento <= SYSUTCDATETIME())
          AND  (@RolActor <> 'Cliente' OR p.IDUsuario = @IDUsuarioActor);
        SET @Tomado = IIF(@@ROWCOUNT = 1, 1, 0);

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT r.IDReembolso, r.Origen, r.Monto, r.LlaveIdempotencia, r.TokenReclamo, i.IDTransaccionPasarela,
           i.LlaveIdempotencia AS LlaveIntento
    FROM   dbo.Reembolso AS r
    JOIN   dbo.Pedido AS p ON p.IDPedido = r.IDPedido
    JOIN   dbo.IntentoPago AS i ON i.IDIntentoPago = p.IDIntentoPago
    WHERE  r.IDReembolso = @IDReembolso AND @Tomado = 1;
END
GO
