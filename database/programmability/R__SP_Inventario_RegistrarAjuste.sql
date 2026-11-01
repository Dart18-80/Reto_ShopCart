-- RF-03, N-07: el Operador ajusta la existencia física (cantidad positiva o negativa) con un motivo
-- obligatorio. Bajo el bloqueo de la variante (el mismo que toma todo proceso que reserva, sqlserver-sp
-- §9.1) calcula lo reservado vigente: un ajuste no deja la existencia negativa (50302) ni por debajo de lo
-- reservado (50303, con el máximo ajustable en detalles, A-19). Pasa por SP_Inventario_RegistrarMovimiento.
-- Devuelve el movimiento registrado.
CREATE OR ALTER PROCEDURE dbo.SP_Inventario_RegistrarAjuste
    @IDVariante     INT,
    @Cantidad       INT,
    @Motivo         NVARCHAR(250),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    IF NULLIF(LTRIM(RTRIM(@Motivo)), N'') IS NULL
        THROW 50304, N'El ajuste requiere un motivo.', 1;
    IF @Cantidad IS NULL OR @Cantidad = 0
        THROW 50003, N'La cantidad del ajuste no puede ser cero.', 1;

    DECLARE @IDMovimiento BIGINT;

    BEGIN TRY
        BEGIN TRAN;

        DECLARE @Fisica INT, @Reservado INT;
        SELECT @Fisica = v.ExistenciaFisica
        FROM   dbo.Variante AS v WITH (UPDLOCK, ROWLOCK)
        WHERE  v.IDVariante = @IDVariante;

        IF @Fisica IS NULL
            THROW 50001, N'La variante no existe.', 1;

        SELECT @Reservado = d.Reservado FROM dbo.FU_Inventario_Disponible(@IDVariante) AS d;

        IF @Fisica + @Cantidad < 0
            THROW 50302, N'El ajuste dejaría la existencia en negativo.', 1;
        IF @Fisica + @Cantidad < @Reservado
        BEGIN
            DECLARE @Error NVARCHAR(2048) = (
                SELECT N'Hay unidades reservadas en pagos en curso: el ajuste no puede bajar de lo reservado.'
                           AS mensaje,
                       @Fisica - @Reservado AS [detalles.maximoAjustable]
                FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
            THROW 50303, @Error, 1;
        END

        DECLARE @Tipo VARCHAR(30) = CASE WHEN @Cantidad > 0 THEN 'AjustePositivo' ELSE 'AjusteNegativo' END,
                @Absoluta INT = ABS(@Cantidad);

        EXEC dbo.SP_Inventario_RegistrarMovimiento
             @IDVariante = @IDVariante, @CodigoTipo = @Tipo, @Cantidad = @Absoluta,
             @Motivo = @Motivo, @Referencia = NULL, @IDPedido = NULL, @IDDevolucion = NULL,
             @IDMovimientoKardex = @IDMovimiento OUTPUT;

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
