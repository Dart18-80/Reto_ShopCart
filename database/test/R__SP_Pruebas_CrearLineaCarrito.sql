-- Solo existe en shopcart_test: agrega una variante al carrito activo de un usuario (lo crea si no
-- existe), con su precio vigente garantizado, para comprobar que borrar la variante borra sus líneas
-- (N-14) antes de que exista el módulo de carrito (E4).
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CrearLineaCarrito
    @IDUsuario      INT,
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

        DECLARE @IDCarrito INT = (SELECT IDCarrito FROM dbo.Carrito WITH (UPDLOCK, HOLDLOCK)
                                  WHERE IDUsuario = @IDUsuario AND Estado = 'Activo');
        IF @IDCarrito IS NULL
        BEGIN
            INSERT INTO dbo.Carrito (IDUsuario, Estado) VALUES (@IDUsuario, 'Activo');
            SET @IDCarrito = SCOPE_IDENTITY();
        END

        INSERT INTO dbo.LineaCarrito (IDCarrito, IDVariante, Cantidad, IDPrecioVarianteGarantizado,
                                      FechaGarantiaHasta)
        SELECT @IDCarrito, @IDVariante, 1, pv.IDPrecioVariante, DATEADD(DAY, 3, SYSUTCDATETIME())
        FROM   dbo.FU_Catalogo_PrecioVigente(@IDVariante) AS pv;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT @IDCarrito AS IDCarrito;
END
GO
