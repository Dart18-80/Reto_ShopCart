-- N-08, RF-07: el Operador o el Admin mueve un pedido por su ciclo (Pagado → EnPreparacion → Despachado →
-- Entregado). Concurrencia optimista: solo procede si el pedido sigue en @EstadoEsperado (si no, 50002).
-- La transición debe existir en TransicionEstadoPedido para el rol del actor (50701); TR_Pedidos_ValidarTransicion
-- lo vuelve a exigir ante cualquier UPDATE. Cancelado, DevueltoParcial y Devuelto no se alcanzan por aquí: los
-- escriben la cancelación (con su reembolso) y el SP de devoluciones (que deriva el estado de lo devuelto).
-- Escribe el estado y su HistorialEstadoPedido (usuario, fecha y hora, anterior, nuevo y motivo) en la misma
-- transacción y devuelve el pedido (SP_Pedidos_ObtenerDetalle).
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_CambiarEstado
    @IDPedido       INT,
    @EstadoEsperado VARCHAR(20),
    @EstadoNuevo    VARCHAR(20),
    @Motivo         NVARCHAR(250)    = NULL,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor NOT IN ('Operador', 'Administrador') OR @IDUsuarioActor IS NULL
        THROW 50005, N'Solo el Operador y el Administrador cambian el estado de un pedido.', 1;

    DECLARE @IDEsperado INT = (SELECT e.IDEstadoPedido FROM dbo.EstadoPedido AS e WHERE e.Codigo = @EstadoEsperado),
            @IDNuevo    INT = (SELECT e.IDEstadoPedido FROM dbo.EstadoPedido AS e WHERE e.Codigo = @EstadoNuevo),
            @IDActual   INT;

    IF @IDEsperado IS NULL OR @IDNuevo IS NULL
        THROW 50003, N'El estado no es válido.', 1;
    IF @EstadoNuevo IN ('Cancelado', 'DevueltoParcial', 'Devuelto')
        THROW 50701, N'Ese estado se alcanza cancelando el pedido o registrando una devolución.', 1;
    IF NOT EXISTS (SELECT 1 FROM dbo.TransicionEstadoPedido AS t
                   JOIN dbo.Rol AS r ON r.IDRol = t.IDRol
                   WHERE t.IDEstadoOrigen = @IDEsperado AND t.IDEstadoDestino = @IDNuevo AND r.Codigo = @RolActor)
        THROW 50701, N'El pedido no puede pasar a ese estado.', 1;

    BEGIN TRY
        BEGIN TRAN;

        SELECT @IDActual = p.IDEstadoPedido FROM dbo.Pedido AS p WITH (UPDLOCK, ROWLOCK) WHERE p.IDPedido = @IDPedido;
        IF @IDActual IS NULL
            THROW 50001, N'El pedido no existe.', 1;

        -- sqlserver-sp §9.4: concurrencia optimista sobre el estado.
        UPDATE dbo.Pedido
        SET    IDEstadoPedido = @IDNuevo, FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDPedido = @IDPedido AND IDEstadoPedido = @IDEsperado;
        IF @@ROWCOUNT = 0
            THROW 50002, N'El pedido cambió de estado. Recarga para ver el estado actual.', 1;

        INSERT INTO dbo.HistorialEstadoPedido (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Motivo, RequestId)
        VALUES (@IDPedido, @IDEsperado, @IDNuevo, @IDUsuarioActor, NULLIF(LTRIM(RTRIM(@Motivo)), N''), @RequestId);

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    EXEC dbo.SP_Pedidos_ObtenerDetalle @IDPedido = @IDPedido, @IDUsuarioActor = @IDUsuarioActor,
                                       @RolActor = @RolActor, @RequestId = @RequestId;
END
GO
