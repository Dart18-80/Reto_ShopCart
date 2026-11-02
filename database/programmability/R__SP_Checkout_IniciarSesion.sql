-- RF-06, N-01, N-02, N-06, N-12 (01 §6.1, plan E5-H01): el cliente inicia el pago de su carrito.
-- Orden de bloqueo (01 §6.6): carrito → variantes por IDVariante → sesión → cupón.
-- 1. Bajo esos bloqueos se arma la instantánea (precio efectivo y su versión, descuento por línea, envío
--    sobre el subtotal comprable después del cupón y la dirección del cliente) y su HashContenido: JSON
--    canónico (líneas por IDVariante, decimales en formato fijo).
-- 2. Si la sesión Activa tiene el mismo hash y no venció, se devuelve tal cual (Creada = 0, la API responde
--    200). Si no, se cancela por la única ruta de liberación (SP_Checkout_CancelarSesionActiva; con un pago
--    en curso responde 50602).
-- 3. Todo o nada: líneas NoDisponible → 50402. Después: sesión, líneas congeladas (M-04), las reservas por
--    SP_Inventario_ReservarExistencia (vencen en MinutosReserva; disponible < cantidad en alguna línea → 50301
--    con todas las que fallan y se revierte todo) y, si hay cupón, su uso reservado (SP_Cupones_ReservarUso).
--    Creada = 1 (201).
-- Devuelve Creada y la sesión (SP_Checkout_ObtenerSesion).
CREATE OR ALTER PROCEDURE dbo.SP_Checkout_IniciarSesion
    @IDDireccion    INT,
    @IDMetodoEnvio  INT,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor, @RolActor, @RequestId;

    DECLARE @IDCliente INT = CASE WHEN @RolActor = 'Cliente' THEN @IDUsuarioActor END;
    IF @IDCliente IS NULL
        THROW 50005, N'Solo un cliente puede iniciar un pago.', 1;

    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();
    DECLARE @IDCarrito INT, @IDCupon INT, @CodigoCupon VARCHAR(30), @ID INT, @Bloqueada INT,
            @NombreRecibe NVARCHAR(100), @TelefonoRecibe VARCHAR(8), @IDMunicipio INT, @Municipio NVARCHAR(80),
            @Departamento NVARCHAR(50), @DireccionLinea NVARCHAR(200), @Referencia NVARCHAR(200),
            @NombreMetodo NVARCHAR(50), @DiasMin TINYINT, @DiasMax TINYINT, @CostoEnvio DECIMAL(12,2),
            @Subtotal DECIMAL(15,2), @Descuento DECIMAL(15,2), @Hash BINARY(32), @IDSesion INT,
            @HashActiva BINARY(32), @ExpiraActiva DATETIME2(3), @MinutosReserva SMALLINT, @Vence DATETIME2(3),
            @Reservas NVARCHAR(MAX), @Creada BIT = 0, @Error NVARCHAR(2048);
    DECLARE @Lineas TABLE (
        IDVariante       INT           NOT NULL PRIMARY KEY,
        IDLineaCarrito   INT           NOT NULL,
        Producto         NVARCHAR(150) NOT NULL,
        Cantidad         INT           NOT NULL,
        IDPrecioVariante INT           NOT NULL,
        PrecioUnitario   DECIMAL(12,2) NOT NULL,
        DescuentoLinea   DECIMAL(12,2) NOT NULL,
        Estado           VARCHAR(20)   NOT NULL);

    BEGIN TRY
        BEGIN TRAN;

        -- 01 §6.6: primero el carrito. Serializa todo lo que el cliente hace con su checkout.
        EXEC dbo.SP_Carrito_BloquearActivo @IDCliente, NULL, @IDCarrito OUTPUT;

        IF @IDCarrito IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.LineaCarrito AS l WHERE l.IDCarrito = @IDCarrito)
            THROW 50403, N'Tu carrito está vacío.', 1;

        -- Después, las variantes en orden de IDVariante (sqlserver-sp §9.1): precios y disponible estables.
        SET @ID = (SELECT MIN(l.IDVariante) FROM dbo.LineaCarrito AS l WHERE l.IDCarrito = @IDCarrito);
        WHILE @ID IS NOT NULL
        BEGIN
            SELECT @Bloqueada = v.IDVariante FROM dbo.Variante AS v WITH (UPDLOCK, ROWLOCK) WHERE v.IDVariante = @ID;
            SET @ID = (SELECT MIN(l.IDVariante) FROM dbo.LineaCarrito AS l
                       WHERE l.IDCarrito = @IDCarrito AND l.IDVariante > @ID);
        END

        SELECT @IDCupon = c.IDCupon FROM dbo.Carrito AS c WHERE c.IDCarrito = @IDCarrito;
        SET @CodigoCupon = (SELECT cu.Codigo FROM dbo.Cupon AS cu WHERE cu.IDCupon = @IDCupon);

        INSERT INTO @Lineas (IDVariante, IDLineaCarrito, Producto, Cantidad, IDPrecioVariante, PrecioUnitario,
                             DescuentoLinea, Estado)
        SELECT l.IDVariante, l.IDLineaCarrito, l.Producto, l.Cantidad, l.IDPrecioVarianteEfectivo, l.PrecioUnitario,
               COALESCE(dc.DescuentoLinea, 0), l.Estado
        FROM   dbo.FU_Carrito_Lineas(@IDCarrito) AS l
        LEFT JOIN dbo.FU_Cupones_CalculoDescuento(@IDCupon, @IDCarrito) AS dc ON dc.IDLineaCarrito = l.IDLineaCarrito;

        -- RF-01: una dirección ajena responde igual que una inexistente.
        SELECT @NombreRecibe = d.NombreRecibe, @TelefonoRecibe = d.TelefonoRecibe, @IDMunicipio = d.IDMunicipio,
               @Municipio = m.Nombre, @Departamento = dp.Nombre, @DireccionLinea = d.DireccionLinea,
               @Referencia = d.Referencia
        FROM   dbo.Direccion    AS d
        JOIN   dbo.Municipio    AS m  ON m.IDMunicipio = d.IDMunicipio
        JOIN   dbo.Departamento AS dp ON dp.IDDepartamento = m.IDDepartamento
        WHERE  d.IDDireccion = @IDDireccion AND d.IDUsuario = @IDCliente;

        IF @NombreRecibe IS NULL
            THROW 50001, N'La dirección no existe.', 1;

        SELECT @Subtotal = CONVERT(DECIMAL(15,2), SUM(l.PrecioUnitario * l.Cantidad)),
               @Descuento = CONVERT(DECIMAL(15,2), SUM(l.DescuentoLinea))
        FROM   @Lineas AS l;

        -- N-04: el envío gratis se evalúa sobre el subtotal después del cupón.
        SELECT @NombreMetodo = e.Nombre, @DiasMin = e.DiasMin, @DiasMax = e.DiasMax, @CostoEnvio = e.Costo
        FROM   dbo.FU_Envios_Costos(@Subtotal - @Descuento) AS e
        WHERE  e.IDMetodoEnvio = @IDMetodoEnvio;

        IF @NombreMetodo IS NULL
            THROW 50001, N'El método de envío no existe o no está disponible.', 1;

        -- Plan E5-H01 §4: JSON canónico (líneas por IDVariante, decimales con formato fijo).
        SET @Hash = HASHBYTES('SHA2_256',
        (
            SELECT (SELECT l.IDVariante AS variante, l.Cantidad AS cantidad, l.IDPrecioVariante AS version,
                           CONVERT(VARCHAR(20), l.PrecioUnitario) AS precio,
                           CONVERT(VARCHAR(20), l.DescuentoLinea) AS descuento
                    FROM   @Lineas AS l
                    ORDER BY l.IDVariante
                    FOR JSON PATH) AS lineas,
                   @IDCupon AS cupon, @IDMetodoEnvio AS metodo, CONVERT(VARCHAR(20), @CostoEnvio) AS envio,
                   @IDDireccion AS direccion, @NombreRecibe AS recibe, @TelefonoRecibe AS telefono,
                   @IDMunicipio AS municipio, @DireccionLinea AS linea, @Referencia AS referencia
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER, INCLUDE_NULL_VALUES
        ));

        -- 01 §6.6: después de las variantes, la sesión.
        SELECT @IDSesion = s.IDSesionCheckout, @HashActiva = s.HashContenido, @ExpiraActiva = s.FechaExpiracion
        FROM   dbo.SesionCheckout AS s WITH (UPDLOCK, ROWLOCK)
        WHERE  s.IDUsuario = @IDCliente AND s.Estado = 'Activa';

        IF NOT (@IDSesion IS NOT NULL AND @HashActiva = @Hash AND @ExpiraActiva > @Ahora)
        BEGIN
            EXEC dbo.SP_Checkout_CancelarSesionActiva @IDCliente;

            IF EXISTS (SELECT 1 FROM @Lineas AS l WHERE l.Estado = 'NoDisponible')
            BEGIN
                SET @Error = (SELECT N'Algunos productos ya no están disponibles: quítalos del carrito.' AS mensaje,
                                     JSON_QUERY((SELECT l.IDLineaCarrito AS idLinea, l.IDVariante AS idVariante,
                                                        l.Producto AS producto, l.Estado AS estado
                                                 FROM @Lineas AS l WHERE l.Estado = 'NoDisponible'
                                                 ORDER BY l.IDVariante FOR JSON PATH)) AS detalles
                              FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
                THROW 50402, @Error, 1;
            END

            SELECT TOP (1) @MinutosReserva = ps.MinutosReserva FROM dbo.ParametroSistema AS ps
            ORDER BY ps.IDParametroSistema;
            SET @Vence = DATEADD(MINUTE, @MinutosReserva, @Ahora);

            INSERT INTO dbo.SesionCheckout (
                IDUsuario, IDCarrito, Estado, HashContenido, NombreRecibe, TelefonoRecibe, IDMunicipio,
                Departamento, Municipio, DireccionLinea, Referencia, IDMetodoEnvio, NombreMetodoEnvio, DiasMin,
                DiasMax, IDCupon, CodigoCupon, Subtotal, Descuento, CostoEnvio, Total, FechaExpiracion)
            VALUES (
                @IDCliente, @IDCarrito, 'Activa', @Hash, @NombreRecibe, @TelefonoRecibe, @IDMunicipio,
                @Departamento, @Municipio, @DireccionLinea, @Referencia, @IDMetodoEnvio, @NombreMetodo, @DiasMin,
                @DiasMax, @IDCupon, @CodigoCupon, @Subtotal, @Descuento, @CostoEnvio,
                @Subtotal - @Descuento + @CostoEnvio, @Vence);
            SET @IDSesion = SCOPE_IDENTITY();

            -- N-02: lo que se cobra queda congelado en la sesión.
            INSERT INTO dbo.LineaSesionCheckout (IDSesionCheckout, IDVariante, IDPrecioVariante, Cantidad,
                                                 PrecioUnitario, DescuentoLinea, TotalLinea)
            SELECT @IDSesion, l.IDVariante, l.IDPrecioVariante, l.Cantidad, l.PrecioUnitario, l.DescuentoLinea,
                   l.PrecioUnitario * l.Cantidad - l.DescuentoLinea
            FROM   @Lineas AS l;

            -- N-06: todo o nada, sin las reservas de la sesión cancelada; un 50301 revierte la sesión y sus líneas.
            SET @Reservas = (SELECT l.IDVariante AS idVariante, l.Cantidad AS cantidad FROM @Lineas AS l
                             ORDER BY l.IDVariante FOR JSON PATH);
            EXEC dbo.SP_Inventario_ReservarExistencia @IDSesion, @Reservas, @Vence;

            -- 01 §6.6: el cupón es lo último que se bloquea.
            IF @IDCupon IS NOT NULL
                EXEC dbo.SP_Cupones_ReservarUso @IDCupon, @IDSesion, @IDCliente, @IDCarrito, @Descuento;

            SET @Creada = 1;
        END

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        -- UX_SesionCheckout_ActivaPorUsuario es la última defensa: el bloqueo del carrito ya serializa.
        IF ERROR_NUMBER() IN (2601, 2627) AND ERROR_MESSAGE() LIKE N'%UX_SesionCheckout_ActivaPorUsuario%'
            THROW 50002, N'Tu pago se inició al mismo tiempo en otra pestaña. Intenta de nuevo.', 1;
        THROW;
    END CATCH

    SELECT @Creada AS Creada;
    EXEC dbo.SP_Checkout_ObtenerSesion @IDUsuarioActor = @IDUsuarioActor, @RolActor = @RolActor,
                                       @RequestId = @RequestId;
END
GO
