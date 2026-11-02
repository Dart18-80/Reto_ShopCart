-- Solo existe en shopcart_test: llama a SP_Inventario_ReservarExistencia sin abrir una transacción, para
-- comprobar que el SP interno la exige.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_ReservarExistenciaSinTransaccion
    @IDSesionCheckout INT,
    @Lineas           NVARCHAR(MAX),
    @IDUsuarioActor   INT              = NULL,
    @RolActor         VARCHAR(20)      = NULL,
    @RequestId        UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Vence DATETIME2(3) = DATEADD(MINUTE, 15, SYSUTCDATETIME());
    EXEC dbo.SP_Inventario_ReservarExistencia @IDSesionCheckout, @Lineas, @Vence;
END
GO
