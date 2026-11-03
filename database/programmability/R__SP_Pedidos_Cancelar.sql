-- depende-de: R__SP_Pedidos_AplicarCancelacion.sql
-- N-09, RF-07 (plan E6-H03 §2): cancela el pedido completo en una sola transacción. El Cliente cancela los suyos
-- (uno ajeno responde 50001, igual que uno inexistente); el Operador y el Admin, cualquiera. Motivo obligatorio.
-- Lo que hace la cancelación está en SP_Pedidos_AplicarCancelacion. La pasarela se llama después del COMMIT (el
-- servicio). Con el pago EnRevision responde 50706 (E9-H04). Devuelve el reembolso creado.
CREATE OR ALTER PROCEDURE dbo.SP_Pedidos_Cancelar
    @IDPedido       INT,
    @Motivo         NVARCHAR(250),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF @RolActor IS NULL OR @RolActor NOT IN ('Cliente', 'Operador', 'Administrador') OR @IDUsuarioActor IS NULL
        THROW 50005, N'Solo un cliente, un operador o un administrador cancelan un pedido.', 1;
    IF NULLIF(LTRIM(RTRIM(@Motivo)), N'') IS NULL
        THROW 50003, N'La cancelación requiere un motivo.', 1;

    DECLARE @IDReembolso INT,
            @IDCliente INT = CASE WHEN @RolActor = 'Cliente' THEN @IDUsuarioActor END;

    BEGIN TRY
        BEGIN TRAN;

        EXEC dbo.SP_Pedidos_AplicarCancelacion
             @IDPedido = @IDPedido, @Motivo = @Motivo, @IDUsuario = @IDUsuarioActor, @IDCliente = @IDCliente,
             @RequestId = @RequestId, @IDReembolso = @IDReembolso OUTPUT;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627) AND ERROR_MESSAGE() LIKE N'%UX_Reembolso_CancelacionPorPedido%'
            THROW 50702, N'El pedido ya está cancelado.', 1;
        THROW;
    END CATCH

    SELECT @IDReembolso AS IDReembolso;
END
GO
