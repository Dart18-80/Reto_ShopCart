-- Job (A-04, RF-07, N-06): cada minuto marca como Expirada las sesiones de checkout Activa ya vencidas y
-- libera sus reservas y el uso de su cupón por la única ruta de liberación (SP_Inventario_LiberarReservas y
-- SP_Cupones_LiberarUso). No vence una sesión con un intento de pago en curso (Pendiente o Autorizado) cuyo
-- arrendamiento sigue vivo (N-03): esa petición, o la conciliación, todavía la está usando. Idempotente:
-- ejecutarlo dos veces no cambia nada la segunda.
-- sp_getapplock: si la otra réplica lo está ejecutando, retorna sin hacer nada (Ejecutada = 0).
-- Orden de bloqueo (01 §6.6): primero todas las sesiones (por IDSesionCheckout) y después los cupones, como
-- cualquier otro SP (sesión → cupón): el job nunca espera una sesión mientras retiene un cupón.
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_ExpirarSesiones
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @Bloqueo INT, @ID INT, @Estado VARCHAR(10), @Expira DATETIME2(3);
    DECLARE @Vencidas TABLE (IDSesionCheckout INT PRIMARY KEY);

    BEGIN TRY
        BEGIN TRAN;

        EXEC @Bloqueo = sys.sp_getapplock @Resource = N'Job_Checkout_ExpirarSesiones', @LockMode = N'Exclusive',
                                          @LockOwner = N'Transaction', @LockTimeout = 0;
        IF @Bloqueo < 0
        BEGIN
            ROLLBACK;
            SELECT CONVERT(BIT, 0) AS Ejecutada, 0 AS SesionesExpiradas;
            RETURN;
        END

        -- Candidatas sin bloqueo (IX_SesionCheckout_PorExpirar); cada una se vuelve a validar ya bloqueada.
        DECLARE @Candidatas TABLE (IDSesionCheckout INT PRIMARY KEY);
        INSERT INTO @Candidatas (IDSesionCheckout)
        SELECT s.IDSesionCheckout
        FROM   dbo.SesionCheckout AS s
        WHERE  s.Estado = 'Activa' AND s.FechaExpiracion <= SYSUTCDATETIME();

        SET @ID = (SELECT MIN(IDSesionCheckout) FROM @Candidatas);
        WHILE @ID IS NOT NULL
        BEGIN
            SELECT @Estado = s.Estado, @Expira = s.FechaExpiracion
            FROM   dbo.SesionCheckout AS s WITH (UPDLOCK, ROWLOCK)
            WHERE  s.IDSesionCheckout = @ID;

            -- Con la sesión bloqueada ningún pago puede tomarla: el intento que se lee aquí es el definitivo.
            IF @Estado = 'Activa' AND @Expira <= SYSUTCDATETIME()
               AND NOT EXISTS (SELECT 1 FROM dbo.IntentoPago AS i
                               WHERE i.IDSesionCheckout = @ID AND i.Estado IN ('Pendiente', 'Autorizado')
                                 AND i.ArrendadoHasta > SYSUTCDATETIME())
                INSERT INTO @Vencidas (IDSesionCheckout) VALUES (@ID);

            SET @ID = (SELECT MIN(IDSesionCheckout) FROM @Candidatas WHERE IDSesionCheckout > @ID);
        END

        SET @ID = (SELECT MIN(IDSesionCheckout) FROM @Vencidas);
        WHILE @ID IS NOT NULL
        BEGIN
            EXEC dbo.SP_Inventario_LiberarReservas @ID;
            EXEC dbo.SP_Cupones_LiberarUso @ID;

            SET @ID = (SELECT MIN(IDSesionCheckout) FROM @Vencidas WHERE IDSesionCheckout > @ID);
        END

        UPDATE s
        SET    s.Estado = 'Expirada', s.FechaCierre = SYSUTCDATETIME(), s.FechaActualizacion = SYSUTCDATETIME()
        FROM   dbo.SesionCheckout AS s
        JOIN   @Vencidas AS v ON v.IDSesionCheckout = s.IDSesionCheckout;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT CONVERT(BIT, 1) AS Ejecutada, (SELECT COUNT(*) FROM @Vencidas) AS SesionesExpiradas;
END
GO
