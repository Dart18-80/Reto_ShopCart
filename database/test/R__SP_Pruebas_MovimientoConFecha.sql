-- Solo existe en shopcart_test: registra un ajuste positivo de 1 unidad con una fecha propia, con el rol dado,
-- para probar que SP_Inventario_RegistrarMovimiento solo la acepta con el rol Sistema y nunca en el futuro (N-07).
-- Devuelve la fecha con la que quedó el movimiento.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_MovimientoConFecha
    @IDVariante      INT,
    @FechaMovimiento DATETIME2(3),
    @Rol             VARCHAR(20),
    @IDUsuario       INT,
    @IDUsuarioActor  INT              = NULL,
    @RolActor        VARCHAR(20)      = NULL,
    @RequestId       UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuario, @Rol, @RequestId;

    DECLARE @IDMovimiento BIGINT;

    BEGIN TRY
        BEGIN TRAN;
        EXEC dbo.SP_Inventario_RegistrarMovimiento
             @IDVariante = @IDVariante, @CodigoTipo = 'AjustePositivo', @Cantidad = 1, @Motivo = N'Prueba de fecha',
             @Referencia = NULL, @IDPedido = NULL, @IDDevolucion = NULL, @IDMovimientoKardex = @IDMovimiento OUTPUT,
             @FechaMovimiento = @FechaMovimiento;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT m.Fecha FROM dbo.MovimientoKardex AS m WHERE m.IDMovimientoKardex = @IDMovimiento;
END
GO
