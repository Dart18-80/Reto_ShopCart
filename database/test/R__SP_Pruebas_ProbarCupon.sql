-- Solo existe en shopcart_test: aplica código, tipo y valor a un cupón dentro de una transacción que
-- siempre se revierte, para probar CK_Cupon_CodigoMayusculas y CK_Cupon_Valor en sus límites.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_ProbarCupon
    @IDCupon        INT,
    @Codigo         VARCHAR(30),
    @Tipo           VARCHAR(10),
    @Valor          DECIMAL(12,2),
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
        UPDATE dbo.Cupon
        SET    Codigo = @Codigo, Tipo = @Tipo, Valor = @Valor, MontoMaximoDescuento = NULL
        WHERE  IDCupon = @IDCupon;
        ROLLBACK;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
