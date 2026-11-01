-- N-16, RF-03: el Operador registra una entrada de inventario con cantidad, motivo obligatorio y una
-- referencia opcional (por ejemplo, la factura). Pasa por SP_Inventario_RegistrarMovimiento, el único que
-- modifica la existencia y escribe el kardex (N-07). Devuelve el movimiento registrado.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_RegistrarEntrada
    @IDVariante     INT,
    @Cantidad       INT,
    @Motivo         NVARCHAR(250),
    @Referencia     NVARCHAR(100),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF NULLIF(LTRIM(RTRIM(@Motivo)), N'') IS NULL
        THROW 50304, N'La entrada requiere un motivo.', 1;
    IF @Cantidad IS NULL OR @Cantidad <= 0
        THROW 50003, N'La cantidad de la entrada debe ser mayor que cero.', 1;

    DECLARE @IDMovimiento BIGINT;

    BEGIN TRY
        BEGIN TRAN;

        EXEC dbo.SP_Inventario_RegistrarMovimiento
             @IDVariante = @IDVariante, @CodigoTipo = 'EntradaCompra', @Cantidad = @Cantidad,
             @Motivo = @Motivo, @Referencia = @Referencia, @IDPedido = NULL, @IDDevolucion = NULL;

        -- Con la variante aún bloqueada, el último movimiento de la variante es el que se acaba de escribir.
        SET @IDMovimiento = (SELECT MAX(IDMovimientoKardex) FROM dbo.MovimientoKardex
                             WHERE IDVariante = @IDVariante);

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT m.IDMovimientoKardex, m.IDVariante, m.Tipo, m.Signo, m.Cantidad, m.ExistenciaAnterior,
           m.ExistenciaResultante, m.Motivo, m.Referencia, m.IDPedido, m.IDDevolucion, m.IDUsuario,
           m.Usuario, m.Fecha
    FROM   dbo.FU_Inventario_Movimientos(@IDVariante) AS m
    WHERE  m.IDMovimientoKardex = @IDMovimiento;
END
GO
