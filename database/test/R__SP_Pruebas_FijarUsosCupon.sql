-- Solo existe en shopcart_test: fija UsosComprometidos sin pasar por SP_Cupones_ReservarUso, para
-- comprobar que el CHECK del contador es la última defensa del límite (A-13).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_FijarUsosCupon
    @IDCupon           INT,
    @UsosComprometidos INT,
    @IDUsuarioActor    INT              = NULL,
    @RolActor          VARCHAR(20)      = NULL,
    @RequestId         UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- A-18: los triggers de bitácora exigen el contexto (en una prueba sin petición, Rol = 'Sistema').
    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    BEGIN TRY
        BEGIN TRAN;
        UPDATE dbo.Cupon SET UsosComprometidos = @UsosComprometidos WHERE IDCupon = @IDCupon;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
