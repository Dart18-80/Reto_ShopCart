-- Solo existe en shopcart_test: fija DiasGarantiaPrecio y devuelve el valor anterior, para comprobar que el
-- plazo de la garantía sale de ParametroSistema (N-02). Cambia estado global: solo la usan las pruebas
-- secuenciales, que lo restauran al terminar.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_FijarDiasGarantiaPrecio
    @Dias           TINYINT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @Anterior TINYINT;

    BEGIN TRY
        BEGIN TRAN;
        SELECT @Anterior = DiasGarantiaPrecio
        FROM   dbo.ParametroSistema WITH (UPDLOCK)
        WHERE  IDParametroSistema = 1;

        UPDATE dbo.ParametroSistema SET DiasGarantiaPrecio = @Dias WHERE IDParametroSistema = 1;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT @Anterior AS DiasGarantiaPrecio;
END
GO
