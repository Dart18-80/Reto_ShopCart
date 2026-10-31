-- Solo existe en shopcart_test (los "insertar si no existe" usan UPDLOCK, HOLDLOCK porque varias pruebas
-- corren a la vez sobre una base recién creada): crea una variante con datos únicos (categoría, producto, SKU) y un
-- usuario, y asegura los tipos de movimiento de entrada y salida. Cada prueba arma sus propios datos.
CREATE OR ALTER PROCEDURE dbo.SP_Pruebas_CrearVariante
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- A-18: los triggers de bitácora exigen el contexto (en una prueba sin petición, Rol = 'Sistema').
    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @Sufijo NVARCHAR(36) = CONVERT(NVARCHAR(36), NEWID());

    BEGIN TRY
        BEGIN TRAN;

        IF NOT EXISTS (SELECT 1 FROM dbo.Rol WITH (UPDLOCK, HOLDLOCK) WHERE Codigo = 'Cliente')
            INSERT INTO dbo.Rol (Codigo, Nombre) VALUES ('Cliente', N'Cliente');
        IF NOT EXISTS (SELECT 1 FROM dbo.TipoMovimiento WITH (UPDLOCK, HOLDLOCK) WHERE Codigo = 'EntradaCompra')
            INSERT INTO dbo.TipoMovimiento (Codigo, Nombre, Signo, EsManual)
            VALUES ('EntradaCompra', N'Entrada por compra', 1, 1);
        IF NOT EXISTS (SELECT 1 FROM dbo.TipoMovimiento WITH (UPDLOCK, HOLDLOCK) WHERE Codigo = 'SalidaVenta')
            INSERT INTO dbo.TipoMovimiento (Codigo, Nombre, Signo, EsManual)
            VALUES ('SalidaVenta', N'Salida por venta', -1, 0);

        INSERT INTO dbo.Usuario (Correo, HashContrasena, Nombre, IDRol)
        SELECT N'prueba-' + @Sufijo + N'@shopcart.test', 'hash-de-prueba', N'Usuario de prueba', IDRol
        FROM dbo.Rol WHERE Codigo = 'Cliente';
        DECLARE @IDUsuario INT = SCOPE_IDENTITY();

        INSERT INTO dbo.Categoria (Nombre) VALUES (N'Categoría ' + @Sufijo);
        DECLARE @IDCategoria INT = SCOPE_IDENTITY();

        INSERT INTO dbo.Producto (IDCategoria, Nombre) VALUES (@IDCategoria, N'Producto ' + @Sufijo);
        DECLARE @IDProducto INT = SCOPE_IDENTITY();

        INSERT INTO dbo.Variante (IDProducto, SKU, FirmaAtributos, DescripcionAtributos)
        VALUES (@IDProducto, 'P-' + LEFT(REPLACE(@Sufijo, N'-', N''), 30), '', N'Única');
        DECLARE @IDVariante INT = SCOPE_IDENTITY();

        COMMIT;

        SELECT  @IDVariante AS IDVariante,
                @IDUsuario  AS IDUsuario,
                (SELECT IDTipoMovimiento FROM dbo.TipoMovimiento WHERE Codigo = 'EntradaCompra') AS IDTipoEntrada,
                (SELECT IDTipoMovimiento FROM dbo.TipoMovimiento WHERE Codigo = 'SalidaVenta')   AS IDTipoSalida;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END
GO
