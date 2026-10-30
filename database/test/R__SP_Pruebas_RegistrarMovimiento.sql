-- Solo existe en shopcart_test: llama a SP_Inventario_RegistrarMovimiento dentro de una transacción,
-- como lo hará un SP de entrada, y devuelve el movimiento que quedó en el kardex.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_RegistrarMovimiento
    @IDVariante     INT,
    @CodigoTipo     VARCHAR(30),
    @Cantidad       INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    BEGIN TRY
        BEGIN TRAN;

        EXEC dbo.SP_Inventario_RegistrarMovimiento
             @IDVariante = @IDVariante, @CodigoTipo = @CodigoTipo, @Cantidad = @Cantidad,
             @Motivo = N'Movimiento de prueba', @Referencia = NULL, @IDPedido = NULL, @IDDevolucion = NULL;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT TOP (1) t.Codigo AS CodigoTipo, m.Signo, m.Cantidad, m.ExistenciaAnterior, m.ExistenciaResultante,
           m.IDUsuario, m.RequestId, v.ExistenciaFisica
    FROM   dbo.MovimientoKardex AS m
    JOIN   dbo.TipoMovimiento   AS t ON t.IDTipoMovimiento = m.IDTipoMovimiento
    JOIN   dbo.Variante         AS v ON v.IDVariante = m.IDVariante
    WHERE  m.IDVariante = @IDVariante
    ORDER BY m.IDMovimientoKardex DESC;
END
GO
