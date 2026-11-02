-- Solo existe en shopcart_test: agrega una variante, con su precio vigente, a una sesión de checkout nueva
-- de un usuario nuevo, para comprobar que una línea de checkout cuenta como historial (N-14) antes de que
-- exista el checkout (E5).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CrearLineaSesionCheckout
    @IDVariante     INT,
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

        DECLARE @Usuario TABLE (IDUsuario INT);
        INSERT INTO @Usuario
        EXEC dbo.SP_Pruebas_CrearUsuario @IDUsuarioActor = @IDUsuarioActor, @RolActor = @RolActor,
                                         @RequestId = @RequestId;
        DECLARE @IDUsuario INT = (SELECT IDUsuario FROM @Usuario);

        DECLARE @Sesion TABLE (IDSesionCheckout INT);
        INSERT INTO @Sesion
        EXEC dbo.SP_Pruebas_CrearSesionCheckout @IDUsuario = @IDUsuario, @IDUsuarioActor = @IDUsuarioActor,
                                                @RolActor = @RolActor, @RequestId = @RequestId;

        INSERT INTO dbo.LineaSesionCheckout (IDSesionCheckout, IDVariante, IDPrecioVariante, Cantidad,
                                             PrecioUnitario, DescuentoLinea, TotalLinea)
        SELECT s.IDSesionCheckout, @IDVariante, pv.IDPrecioVariante, 1, pv.Precio, 0, pv.Precio
        FROM   @Sesion AS s
        CROSS APPLY dbo.FU_Catalogo_PrecioVigente(@IDVariante) AS pv;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
