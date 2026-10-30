-- Solo existe en shopcart_test: crea una sesión de checkout Activa para el usuario, con sus
-- requisitos (carrito activo, municipio y método de envío). Reutiliza el carrito activo del usuario.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CrearSesionCheckout
    @IDUsuario      INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Sufijo NVARCHAR(32) = REPLACE(CONVERT(NVARCHAR(36), NEWID()), N'-', N'');

    BEGIN TRY
        BEGIN TRAN;

        DECLARE @IDCarrito INT = (SELECT IDCarrito FROM dbo.Carrito WHERE IDUsuario = @IDUsuario AND Estado = 'Activo');
        IF @IDCarrito IS NULL
        BEGIN
            INSERT INTO dbo.Carrito (IDUsuario, Estado) VALUES (@IDUsuario, 'Activo');
            SET @IDCarrito = SCOPE_IDENTITY();
        END;

        INSERT INTO dbo.Departamento (Nombre) VALUES (LEFT(N'D' + @Sufijo, 50));
        DECLARE @IDDepartamento INT = SCOPE_IDENTITY();
        INSERT INTO dbo.Municipio (IDDepartamento, Nombre) VALUES (@IDDepartamento, N'Municipio de prueba');
        DECLARE @IDMunicipio INT = SCOPE_IDENTITY();
        INSERT INTO dbo.MetodoEnvio (Codigo, Nombre, Costo, DiasMin, DiasMax)
        VALUES (LEFT('E' + CONVERT(VARCHAR(32), @Sufijo), 20), N'Envío de prueba', 35, 3, 5);
        DECLARE @IDMetodoEnvio INT = SCOPE_IDENTITY();

        INSERT INTO dbo.SesionCheckout (
            IDUsuario, IDCarrito, Estado, HashContenido, NombreRecibe, TelefonoRecibe, IDMunicipio,
            Departamento, Municipio, DireccionLinea, IDMetodoEnvio, NombreMetodoEnvio, DiasMin, DiasMax,
            Subtotal, Descuento, CostoEnvio, Total, FechaExpiracion)
        VALUES (
            @IDUsuario, @IDCarrito, 'Activa', HASHBYTES('SHA2_256', @Sufijo), N'Cliente de prueba', '55555555',
            @IDMunicipio, N'Departamento de prueba', N'Municipio de prueba', N'Dirección de prueba',
            @IDMetodoEnvio, N'Envío de prueba', 3, 5, 100, 0, 35, 135, DATEADD(MINUTE, 15, SYSUTCDATETIME()));
        DECLARE @IDSesionCheckout INT = SCOPE_IDENTITY();

        COMMIT;
        SELECT @IDSesionCheckout AS IDSesionCheckout;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
