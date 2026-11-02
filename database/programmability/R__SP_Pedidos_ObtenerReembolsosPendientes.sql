-- Job (A-04, N-09): cada 5 minutos lista hasta @Maximo reembolsos Pendiente cuyo próximo intento ya llegó. El
-- servicio procesa cada uno tomándolo con SP_Pedidos_TomarReembolso (compare-and-set sobre FechaProximoIntento),
-- así cada reembolso lo procesa una sola réplica aunque las dos lo listen.
-- sp_getapplock: si la otra réplica lo está ejecutando, devuelve Ejecutada = 0 y ningún reembolso.
-- Dos conjuntos: si se ejecutó y los reembolsos pendientes. Solo el rol Sistema.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ObtenerReembolsosPendientes
    @Maximo         INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor <> 'Sistema'
        THROW 50005, N'Solo los jobs ejecutan esta tarea.', 1;
    IF @Maximo IS NULL OR @Maximo NOT BETWEEN 1 AND 500
        THROW 50005, N'SP_Pedidos_ObtenerReembolsosPendientes recibió un máximo inválido.', 1;

    DECLARE @Bloqueo INT;
    DECLARE @Pendientes TABLE (IDReembolso INT PRIMARY KEY);

    BEGIN TRY
        BEGIN TRAN;

        EXEC @Bloqueo = sys.sp_getapplock @Resource = N'Job_Pedidos_ReintentarReembolsos', @LockMode = N'Exclusive',
                                          @LockOwner = N'Transaction', @LockTimeout = 0;
        IF @Bloqueo < 0
        BEGIN
            ROLLBACK;
            SELECT CONVERT(BIT, 0) AS Ejecutada;
            SELECT CONVERT(INT, NULL) AS IDReembolso WHERE 1 = 0;
            RETURN;
        END

        -- IX_Reembolso_Pendientes (FechaProximoIntento) WHERE Estado = 'Pendiente'.
        INSERT INTO @Pendientes (IDReembolso)
        SELECT TOP (@Maximo) r.IDReembolso
        FROM   dbo.Reembolso AS r
        WHERE  r.Estado = 'Pendiente' AND r.FechaProximoIntento <= SYSUTCDATETIME()
        ORDER BY r.FechaProximoIntento, r.IDReembolso;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT CONVERT(BIT, 1) AS Ejecutada;
    SELECT p.IDReembolso FROM @Pendientes AS p ORDER BY p.IDReembolso;
END
GO
