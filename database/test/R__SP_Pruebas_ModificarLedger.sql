-- Solo existe en shopcart_test: intenta un UPDATE ('Modificar') o un DELETE ('Eliminar') sobre una tabla
-- ledger (M-01). Las pruebas pasan la acción, nunca texto SQL.
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

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    BEGIN TRY
        BEGIN TRAN;
        DECLARE @Sentencia NVARCHAR(200) = CASE
            WHEN @Tabla = 'Bitacora'              AND @Operacion = 'Modificar' THEN N'UPDATE dbo.Bitacora SET Modulo = Modulo;'
            WHEN @Tabla = 'Bitacora'              AND @Operacion = 'Eliminar' THEN N'DELETE FROM dbo.Bitacora;'
            WHEN @Tabla = 'MovimientoKardex'      AND @Operacion = 'Modificar' THEN N'UPDATE dbo.MovimientoKardex SET Motivo = Motivo;'
            WHEN @Tabla = 'MovimientoKardex'      AND @Operacion = 'Eliminar' THEN N'DELETE FROM dbo.MovimientoKardex;'
            WHEN @Tabla = 'HistorialEstadoPedido' AND @Operacion = 'Modificar' THEN N'UPDATE dbo.HistorialEstadoPedido SET Motivo = Motivo;'
            WHEN @Tabla = 'HistorialEstadoPedido' AND @Operacion = 'Eliminar' THEN N'DELETE FROM dbo.HistorialEstadoPedido;'
        END;

        IF @Sentencia IS NULL
            THROW 50003, N'Tabla u operación no válida para la prueba.', 1;

        EXEC sys.sp_executesql @Sentencia;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
