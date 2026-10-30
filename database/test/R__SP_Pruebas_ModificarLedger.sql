-- Solo existe en shopcart_test: intenta un UPDATE o un DELETE sobre una tabla ledger (M-01).
-- El error 37359 es de compilación: por eso cada sentencia va en sp_executesql, como texto fijo
-- elegido de una lista blanca, nunca concatenado.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_ModificarLedger
    @Tabla          VARCHAR(30),
    @Operacion      VARCHAR(10),
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Sentencia NVARCHAR(200) = CASE
        WHEN @Tabla = 'Bitacora'              AND @Operacion = 'UPDATE' THEN N'UPDATE dbo.Bitacora SET Modulo = Modulo;'
        WHEN @Tabla = 'Bitacora'              AND @Operacion = 'DELETE' THEN N'DELETE FROM dbo.Bitacora;'
        WHEN @Tabla = 'MovimientoKardex'      AND @Operacion = 'UPDATE' THEN N'UPDATE dbo.MovimientoKardex SET Motivo = Motivo;'
        WHEN @Tabla = 'MovimientoKardex'      AND @Operacion = 'DELETE' THEN N'DELETE FROM dbo.MovimientoKardex;'
        WHEN @Tabla = 'HistorialEstadoPedido' AND @Operacion = 'UPDATE' THEN N'UPDATE dbo.HistorialEstadoPedido SET Motivo = Motivo;'
        WHEN @Tabla = 'HistorialEstadoPedido' AND @Operacion = 'DELETE' THEN N'DELETE FROM dbo.HistorialEstadoPedido;'
    END;

    IF @Sentencia IS NULL
        THROW 50003, N'Tabla u operación no válida para la prueba.', 1;

    EXEC sys.sp_executesql @Sentencia;
END
GO
