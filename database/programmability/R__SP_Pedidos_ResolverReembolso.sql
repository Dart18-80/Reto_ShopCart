-- E9-H04 (decisión del PO): el Admin resuelve a mano un reembolso Fallido (por ejemplo, devolvió el dinero por
-- transferencia): pasa a ResueltoManual con el motivo, la referencia, quién y cuándo, distinto de Completado.
-- Para los montos ya cuenta como reembolsado: Pedido.MontoReembolsado se sumó al crearlo. Bajo bloqueo: solo
-- desde Fallido (50709; resolver dos veces responde 409). Después nadie lo vuelve a tomar: el job solo toma un
-- Pendiente y el reintento solo pasa un Fallido a Pendiente. Queda en la bitácora (TR_Pedidos_ReembolsoBitacora).
-- Solo el Administrador.
-- Antes, el servicio consulta el reembolso en la pasarela por su llave: si ya lo procesó, no llega aquí
-- (SP_Pedidos_CompletarReembolsoProcesado lo deja Completado). Si después de esa consulta alguien lo reintentó
-- (Fallido, Pendiente y otra vez Fallido, quizá con el dinero ya devuelto), su FechaActualizacion ya no es la
-- leída: 50002. Y solo pasado el plazo desde esa última actualización (50711, decisión del PO): una llamada a la
-- pasarela que la API cortó por timeout puede seguir en vuelo y devolver el dinero después de la consulta. Si la
-- pasarela muestra el cobro sin capturar, tampoco llega aquí (SP_Pedidos_MarcarReembolsoNoAplica).
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ResolverReembolso
    @IDReembolso    INT,
    @Motivo         NVARCHAR(250),
    @Referencia     NVARCHAR(100),
    @FechaActualizacionLeida DATETIME2(3),
    @SegundosEsperaMinima    INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor <> 'Administrador' OR @IDUsuarioActor IS NULL
        THROW 50005, N'Solo el Administrador resuelve un reembolso a mano.', 1;
    IF NULLIF(LTRIM(RTRIM(@Motivo)), N'') IS NULL OR NULLIF(LTRIM(RTRIM(@Referencia)), N'') IS NULL
        THROW 50003, N'La resolución requiere un motivo y una referencia.', 1;
    IF @FechaActualizacionLeida IS NULL OR @SegundosEsperaMinima IS NULL OR @SegundosEsperaMinima <= 0
        THROW 50003, N'Falta la versión del reembolso que se consultó o el plazo para resolverlo.', 1;

    DECLARE @Estado VARCHAR(14), @FechaActualizacion DATETIME2(3);

    BEGIN TRY
        BEGIN TRAN;

        SELECT @Estado = r.Estado, @FechaActualizacion = r.FechaActualizacion
        FROM   dbo.Reembolso AS r WITH (UPDLOCK, ROWLOCK)
        WHERE  r.IDReembolso = @IDReembolso;

        IF @Estado IS NULL
            THROW 50001, N'El reembolso no existe.', 1;
        IF @Estado <> 'Fallido'
            THROW 50709, N'Solo se resuelve a mano un reembolso Fallido; este ya no lo está.', 1;
        -- sqlserver-sp §9.4: concurrencia optimista contra lo que el servicio consultó en la pasarela.
        IF @FechaActualizacion <> @FechaActualizacionLeida
            THROW 50002, N'El reembolso cambió mientras lo resolvías. Recarga y vuelve a intentarlo.', 1;
        IF EXISTS (SELECT 1 FROM dbo.FU_Pedidos_ReembolsoResoluble(@Estado, @FechaActualizacion, @SegundosEsperaMinima) AS a
                   WHERE a.PlazoCumplido = 0)
            THROW 50711, N'Este reembolso falló hace muy poco y la pasarela aún podría estar procesándolo. Espera un momento y vuelve a intentarlo.', 1;

        UPDATE dbo.Reembolso
        SET    Estado = 'ResueltoManual', MotivoResolucion = LTRIM(RTRIM(@Motivo)),
               ReferenciaResolucion = LTRIM(RTRIM(@Referencia)), IDUsuarioResolucion = @IDUsuarioActor,
               FechaResolucion = SYSUTCDATETIME(), FechaProximoIntento = NULL, TokenReclamo = NULL,
               FechaActualizacion = SYSUTCDATETIME()
        WHERE  IDReembolso = @IDReembolso;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT r.IDReembolso, r.IDPedido, p.NumeroPedido, r.IDIntentoPago, r.IDDevolucion, r.Origen, r.Monto, r.Estado,
           r.Intentos, r.UltimoError, r.IDTransaccionReembolso, r.FechaProximoIntento, r.FechaCompletado,
           r.FechaCreacion, r.MotivoResolucion, r.ReferenciaResolucion, r.FechaResolucion,
           a.PuedeReintentar, b.PuedeResolver
    FROM   dbo.Reembolso AS r
    LEFT JOIN dbo.Pedido AS p ON p.IDPedido = r.IDPedido
    CROSS APPLY dbo.FU_Pedidos_ReembolsoReintentable(r.Estado, r.TokenReclamo, r.FechaProximoIntento) AS a
    CROSS APPLY dbo.FU_Pedidos_ReembolsoResoluble(r.Estado, r.FechaActualizacion, @SegundosEsperaMinima) AS b
    WHERE  r.IDReembolso = @IDReembolso;
END
GO
