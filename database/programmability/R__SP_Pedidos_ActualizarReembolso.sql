-- N-09 (plan E6-H03 §3): registra el resultado de devolver el dinero de un reembolso Pendiente que se tomó.
--   @Exito = 1  Completado, con la transacción del reembolso (NULL si se anuló una autorización sin capturar);
--               también desde Fallido: si la pasarela devolvió el dinero, esa es la verdad
--   @Exito = 0  solo si @TokenReclamo sigue siendo el reclamo vigente (un proceso desplazado no suma intentos)
--   @Exito = 0  Intentos + 1 con el último error; al llegar a @MaxIntentos pasa a Fallido y queda en la lista
--               del Admin para resolverlo a mano. Si no, vuelve a estar disponible para el job.
-- Repetir un Completado no cambia nada. Mismos roles que SP_Pedidos_TomarReembolso.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_ActualizarReembolso
    @IDReembolso            INT,
    @Exito                  BIT,
    @IDTransaccionReembolso VARCHAR(64)      = NULL,
    @Error                  NVARCHAR(500)    = NULL,
    @TokenReclamo           UNIQUEIDENTIFIER = NULL,
    @MaxIntentos            TINYINT,
    @SegundosEntreIntentos  INT,
    @IDUsuarioActor         INT              = NULL,
    @RolActor               VARCHAR(20)      = NULL,
    @RequestId              UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor NOT IN ('Cliente', 'Operador', 'Administrador', 'Sistema')
        THROW 50005, N'Rol no válido para procesar un reembolso.', 1;

    BEGIN TRY
        BEGIN TRAN;

        IF @Exito = 1
            UPDATE dbo.Reembolso
            SET    Estado = 'Completado', IDTransaccionReembolso = @IDTransaccionReembolso, UltimoError = NULL,
                   TokenReclamo = NULL,
                   FechaCompletado = SYSUTCDATETIME(), FechaProximoIntento = NULL,
                   FechaActualizacion = SYSUTCDATETIME()
            WHERE  IDReembolso = @IDReembolso AND Estado IN ('Pendiente', 'Fallido')
              AND  (@RolActor <> 'Cliente' OR EXISTS (SELECT 1 FROM dbo.Pedido AS p
                                                     WHERE p.IDPedido = Reembolso.IDPedido
                                                       AND p.IDUsuario = @IDUsuarioActor));
        ELSE
            UPDATE dbo.Reembolso
            SET    Intentos = Intentos + 1, UltimoError = LEFT(@Error, 500), TokenReclamo = NULL,
                   Estado = IIF(Intentos + 1 >= @MaxIntentos, 'Fallido', 'Pendiente'),
                   FechaProximoIntento = IIF(Intentos + 1 >= @MaxIntentos, NULL,
                                             DATEADD(SECOND, @SegundosEntreIntentos, SYSUTCDATETIME())),
                   FechaActualizacion = SYSUTCDATETIME()
            WHERE  IDReembolso = @IDReembolso AND Estado = 'Pendiente' AND TokenReclamo = @TokenReclamo
              AND  (@RolActor <> 'Cliente' OR EXISTS (SELECT 1 FROM dbo.Pedido AS p
                                                     WHERE p.IDPedido = Reembolso.IDPedido
                                                       AND p.IDUsuario = @IDUsuarioActor));

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT r.IDReembolso, r.Estado, r.Intentos FROM dbo.Reembolso AS r WHERE r.IDReembolso = @IDReembolso;
END
GO
