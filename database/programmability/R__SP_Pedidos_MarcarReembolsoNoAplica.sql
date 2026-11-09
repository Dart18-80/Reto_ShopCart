-- E9-H04 (decisión del PO): al resolver a mano un reembolso Fallido, la pasarela mostró que su cobro nunca se capturó
-- o se anuló: no hay dinero que devolver. El reembolso pasa a NoAplica con el motivo, quién y cuándo (queda en la
-- bitácora por TR_Pedidos_ReembolsoBitacora) y deja de contar como reembolsado: su monto se resta de
-- Pedido.MontoReembolsado (A-13: el CHECK del contador es la última defensa). Igual que SP_Pedidos_ResolverReembolso,
-- bajo bloqueo: solo desde Fallido (50709), con la versión que se leyó antes de consultar la pasarela (50002) y pasado
-- el plazo desde su última actualización (50711). Bloquea el pedido antes que el reembolso, como la cancelación y la
-- devolución que lo crean. Solo el Administrador.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_MarcarReembolsoNoAplica
    @IDReembolso             INT,
    @Motivo                  NVARCHAR(250),
    @FechaActualizacionLeida DATETIME2(3),
    @SegundosEsperaMinima    INT,
    @IDUsuarioActor          INT              = NULL,
    @RolActor                VARCHAR(20)      = NULL,
    @RequestId               UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor <> 'Administrador' OR @IDUsuarioActor IS NULL
        THROW 50005, N'Solo el Administrador resuelve un reembolso a mano.', 1;
    IF NULLIF(LTRIM(RTRIM(@Motivo)), N'') IS NULL
        THROW 50003, N'Falta el motivo por el que el reembolso no aplica.', 1;
    IF @FechaActualizacionLeida IS NULL OR @SegundosEsperaMinima IS NULL OR @SegundosEsperaMinima <= 0
        THROW 50003, N'Falta la versión del reembolso que se consultó o el plazo para resolverlo.', 1;

    -- IDPedido no cambia nunca: se lee sin bloqueo solo para bloquear primero el pedido.
    DECLARE @IDPedido INT = (SELECT r.IDPedido FROM dbo.Reembolso AS r WHERE r.IDReembolso = @IDReembolso),
            @Estado VARCHAR(14), @FechaActualizacion DATETIME2(3), @Monto DECIMAL(12,2), @Bloqueado INT;

    BEGIN TRY
        BEGIN TRAN;

        IF @IDPedido IS NOT NULL
            SELECT @Bloqueado = p.IDPedido FROM dbo.Pedido AS p WITH (UPDLOCK, ROWLOCK) WHERE p.IDPedido = @IDPedido;

        SELECT @Estado = r.Estado, @FechaActualizacion = r.FechaActualizacion, @Monto = r.Monto
        FROM   dbo.Reembolso AS r WITH (UPDLOCK, ROWLOCK)
        WHERE  r.IDReembolso = @IDReembolso;

        IF @Estado IS NULL
            THROW 50001, N'El reembolso no existe.', 1;
        IF @Estado <> 'Fallido'
            THROW 50709, N'Solo se resuelve a mano un reembolso Fallido; este ya no lo está.', 1;
        IF @FechaActualizacion <> @FechaActualizacionLeida
            THROW 50002, N'El reembolso cambió mientras lo resolvías. Recarga y vuelve a intentarlo.', 1;
        IF EXISTS (SELECT 1 FROM dbo.FU_Pedidos_ReembolsoResoluble(@Estado, @FechaActualizacion, @SegundosEsperaMinima) AS a
                   WHERE a.PlazoCumplido = 0)
            THROW 50711, N'Este reembolso falló hace muy poco y la pasarela aún podría estar procesándolo. Espera un momento y vuelve a intentarlo.', 1;

        UPDATE dbo.Reembolso
        SET    Estado = 'NoAplica', MotivoResolucion = LTRIM(RTRIM(@Motivo)), IDUsuarioResolucion = @IDUsuarioActor,
               FechaResolucion = SYSUTCDATETIME(), FechaProximoIntento = NULL, TokenReclamo = NULL,
               FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDReembolso = @IDReembolso;

        IF @IDPedido IS NOT NULL
            UPDATE dbo.Pedido
            SET    MontoReembolsado = MontoReembolsado - @Monto, FechaActualizacion = SYSUTCDATETIME()
            WHERE  IDPedido = @IDPedido;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
