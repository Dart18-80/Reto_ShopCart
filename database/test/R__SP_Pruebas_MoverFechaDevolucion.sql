-- Solo existe en shopcart_test: lleva una devolución a un instante UTC dado y recalcula su FechaLocal con
-- FU_Sistema_FechaLocal (la misma que usa SP_Pedidos_RegistrarDevolucion), para probar que los reportes la
-- restan en su propio día de Guatemala, también cerca de la medianoche (N-11, A-12).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_MoverFechaDevolucion
    @IDDevolucion   INT,
    @FechaUtc       DATETIME2(3),
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
        UPDATE d
        SET    d.Fecha = @FechaUtc, d.FechaLocal = f.FechaLocal
        FROM   dbo.Devolucion AS d
        CROSS APPLY dbo.FU_Sistema_FechaLocal(@FechaUtc) AS f
        WHERE  d.IDDevolucion = @IDDevolucion;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
