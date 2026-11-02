-- RNF-1, M-08 (E7-H03): genera los datos demo con fechas relativas a hoy, para que el dashboard tenga datos desde
-- el primer arranque. Determinista: la misma @Semilla da los mismos datos. Idempotente: si ya existen los clientes
-- demo, no hace nada. Solo el rol Sistema (la semilla S006).
--   ~200 clientes demo (demo001@shopcart.gt…, contraseña documentada en el README), @Pedidos pedidos pagados en los
--   últimos @Dias días con sus copias (carrito Convertido, sesión Pagada, intento Capturado, detalle, historial con
--   las fechas reales de cada paso), cancelaciones con su reembolso, devoluciones parciales y totales con su
--   reembolso, carritos abandonados y un cupón por cada mensaje de rechazo de RF-05. La pasarela simulada recibe
--   el cobro Capturado de cada pedido y cada reembolso, con las mismas llaves: así se puede cancelar o devolver
--   un pedido demo durante la demo.
--   El inventario solo cambia con SP_Inventario_RegistrarMovimiento (N-07), con la fecha de cada evento: una
--   entrada inicial antes del periodo, la salida de cada venta en su fecha de pago y los reingresos en la fecha de
--   la cancelación o la devolución, en orden cronológico. Así kardex, pedidos e historial coinciden en el tiempo y
--   VW_Inventario_Conciliacion queda vacía.
--   Autoría: cada acción se atribuye a quien la registraría en la operación real (las altas de clientes como el
--   registro público, sin actor; cupones y entradas al Admin; cada compra y su cancelación a su cliente; las
--   devoluciones al Operador). El rol sigue siendo Sistema, que es el único que puede fechar en el pasado (N-07).
CREATE OR ALTER PROCEDURE dbo.SP_Semilla_GenerarDatosDemo
    @Pedidos        INT              = 1500,
    @Dias           INT              = 90,
    @Semilla        INT              = 2026,
    @IDUsuarioActor INT              = NULL,
    @RolActor       VARCHAR(20)      = NULL,
    @RequestId      UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @RolActor IS NULL OR @RolActor <> 'Sistema'
        THROW 50005, N'Solo la semilla genera los datos demo.', 1;
    IF @Pedidos IS NULL OR @Pedidos NOT BETWEEN 1 AND 100000 OR @Dias IS NULL OR @Dias NOT BETWEEN 14 AND 365
        THROW 50003, N'Los parámetros del generador no son válidos.', 1;
    IF EXISTS (SELECT 1 FROM dbo.Usuario AS u WHERE u.Correo = N'demo001@shopcart.gt')
        RETURN;

    DECLARE @IDAdmin INT       = (SELECT u.IDUsuario FROM dbo.Usuario AS u WHERE u.Correo = N'admin@shopcart.gt'),
            @IDOperador INT    = (SELECT u.IDUsuario FROM dbo.Usuario AS u WHERE u.Correo = N'operador@shopcart.gt'),
            @IDClienteDemo INT = (SELECT u.IDUsuario FROM dbo.Usuario AS u WHERE u.Correo = N'cliente@shopcart.gt'),
            @IDRolCliente INT  = (SELECT r.IDRol FROM dbo.Rol AS r WHERE r.Codigo = 'Cliente');
    IF @IDAdmin IS NULL OR @IDOperador IS NULL OR @IDClienteDemo IS NULL
        THROW 50005, N'Faltan los usuarios demo de S003.', 1;

    DECLARE @Clientes INT = 200, @CarritosAbandonados INT = 40, @SaltoVariante INT = 7,
            @SegundosPorDia INT = 86400, @MargenExistencia INT = 20,
            -- argon2id de 'Demo2026!' (OWASP: 19 MiB, 2 iteraciones, 1 hilo).
            @HashDemo VARCHAR(255) = '$argon2id$v=19$m=19456,p=1,t=2$7UTgzTTEUWTFY3y9/NN69w$dnEBT4lad5yBznPz7jxmemdYvfZfD7SGzCkGiInlk+s',
            @Ahora DATETIME2(3) = SYSUTCDATETIME(),
            @EnvioGratis DECIMAL(12,2) = (SELECT TOP (1) ps.MontoEnvioGratis FROM dbo.ParametroSistema AS ps
                                          ORDER BY ps.IDParametroSistema),
            @DescuentoCupon DECIMAL(12,2) = 10.00,
            @IDPagado INT          = (SELECT e.IDEstadoPedido FROM dbo.EstadoPedido AS e WHERE e.Codigo = 'Pagado'),
            @IDEnPreparacion INT   = (SELECT e.IDEstadoPedido FROM dbo.EstadoPedido AS e WHERE e.Codigo = 'EnPreparacion'),
            @IDDespachado INT      = (SELECT e.IDEstadoPedido FROM dbo.EstadoPedido AS e WHERE e.Codigo = 'Despachado'),
            @IDEntregado INT       = (SELECT e.IDEstadoPedido FROM dbo.EstadoPedido AS e WHERE e.Codigo = 'Entregado'),
            @IDCancelado INT       = (SELECT e.IDEstadoPedido FROM dbo.EstadoPedido AS e WHERE e.Codigo = 'Cancelado'),
            @IDDevueltoParcial INT = (SELECT e.IDEstadoPedido FROM dbo.EstadoPedido AS e WHERE e.Codigo = 'DevueltoParcial'),
            @IDDevuelto INT        = (SELECT e.IDEstadoPedido FROM dbo.EstadoPedido AS e WHERE e.Codigo = 'Devuelto');

    DECLARE @Numeros TABLE (N INT PRIMARY KEY);
    DECLARE @Variantes TABLE (N INT IDENTITY(0,1) PRIMARY KEY, IDVariante INT NOT NULL, IDPrecioVariante INT NOT NULL,
                              Precio DECIMAL(12,2) NOT NULL, SKU VARCHAR(40) NOT NULL, Producto NVARCHAR(150) NOT NULL,
                              Descripcion NVARCHAR(200) NOT NULL, IDCategoria INT NOT NULL, Categoria NVARCHAR(80) NOT NULL);
    DECLARE @Municipios TABLE (N INT IDENTITY(0,1) PRIMARY KEY, IDMunicipio INT NOT NULL, Municipio NVARCHAR(80) NOT NULL,
                               Departamento NVARCHAR(50) NOT NULL);
    DECLARE @ClientesDemo TABLE (N INT IDENTITY(0,1) PRIMARY KEY, IDUsuario INT NOT NULL);
    DECLARE @Plan TABLE (Orden INT PRIMARY KEY, N INT NOT NULL, FechaPago DATETIME2(3) NOT NULL, IDUsuario INT NOT NULL,
                         Express BIT NOT NULL, IDMunicipioN INT NOT NULL, Lineas INT NOT NULL, Base INT NOT NULL,
                         Suerte INT NOT NULL, Cupon VARCHAR(30) NULL);
    DECLARE @LineasPedido TABLE (Linea INT PRIMARY KEY, IDVarianteN INT NOT NULL, Cantidad INT NOT NULL,
                                 Descuento DECIMAL(12,2) NOT NULL, ADevolver INT NOT NULL);
    DECLARE @Eventos TABLE (ID INT IDENTITY(1,1) PRIMARY KEY, Fecha DATETIME2(3) NOT NULL, Tipo VARCHAR(12) NOT NULL,
                            IDPedido INT NULL, IDDevolucion INT NULL, IDVariante INT NULL, Cantidad INT NULL);

    BEGIN TRY
        BEGIN TRAN;

        -- Números para generar en conjunto (pedidos, líneas y clientes).
        INSERT INTO @Numeros (N)
        SELECT TOP (@Pedidos + @Clientes) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1
        FROM   sys.all_columns AS a CROSS JOIN sys.all_columns AS b;

        -- El catálogo vendible (S004) con existencia: las variantes agotadas a propósito siguen agotadas, y la de
        -- la demo de compra simultánea conserva su única unidad.
        INSERT INTO @Variantes (IDVariante, IDPrecioVariante, Precio, SKU, Producto, Descripcion, IDCategoria, Categoria)
        SELECT v.IDVariante, pv.IDPrecioVariante, pv.Precio, v.SKU, p.Nombre, v.DescripcionAtributos, c.IDCategoria, c.Nombre
        FROM   dbo.Variante AS v
        JOIN   dbo.Producto AS p ON p.IDProducto = v.IDProducto
        JOIN   dbo.Categoria AS c ON c.IDCategoria = p.IDCategoria
        CROSS APPLY dbo.FU_Catalogo_PrecioVigente(v.IDVariante) AS pv
        WHERE  v.Activo = 1 AND p.Activo = 1 AND c.Activo = 1 AND v.ExistenciaFisica > 0
          AND  v.SKU <> 'DEMO-CONCURRENCIA'
        ORDER BY v.IDVariante;

        DECLARE @TotalVariantes INT = (SELECT COUNT(*) FROM @Variantes);
        IF @TotalVariantes < 3 * @SaltoVariante
            THROW 50005, N'El catálogo demo (S004) no tiene suficientes variantes vendibles.', 1;

        INSERT INTO @Municipios (IDMunicipio, Municipio, Departamento)
        SELECT m.IDMunicipio, m.Nombre, d.Nombre
        FROM   dbo.Municipio AS m JOIN dbo.Departamento AS d ON d.IDDepartamento = m.IDDepartamento
        ORDER BY m.IDMunicipio;
        DECLARE @TotalMunicipios INT = (SELECT COUNT(*) FROM @Municipios);

        -- Clientes demo, como los registra SP_Auth_RegistrarCliente: sin actor.
        EXEC dbo.SP_Sistema_EstablecerContexto NULL, 'Sistema', @RequestId;
        INSERT INTO dbo.Usuario (Correo, HashContrasena, Nombre, IDRol, FechaCreacion)
        SELECT CONCAT(N'demo', RIGHT(CONCAT('00', n.N + 1), 3), N'@shopcart.gt'), @HashDemo,
               CONCAT(N'Cliente Demo ', n.N + 1), @IDRolCliente, DATEADD(DAY, -@Dias - 5, @Ahora)
        FROM   @Numeros AS n
        WHERE  n.N < @Clientes;

        INSERT INTO @ClientesDemo (IDUsuario)
        SELECT u.IDUsuario FROM dbo.Usuario AS u
        WHERE  u.Correo LIKE N'demo[0-9][0-9][0-9]@shopcart.gt'
        ORDER BY u.IDUsuario;

        -- RF-05: un cupón por cada mensaje de rechazo, más uno vigente.
        EXEC dbo.SP_Sistema_EstablecerContexto @IDAdmin, 'Sistema', @RequestId;
        DECLARE @IDCategoriaCupon INT = (SELECT MIN(c.IDCategoria) FROM dbo.Categoria AS c WHERE c.Activo = 1);
        INSERT INTO dbo.Cupon (Codigo, Descripcion, Tipo, Valor, MontoMaximoDescuento, MontoMinimoCompra, IDCategoria,
                               FechaInicio, FechaFin, LimiteUsosTotal, LimiteUsosPorCliente, Activo)
        VALUES ('DEMO10', N'10 % de descuento (vigente)', 'Porcentaje', 10, 100, 0, NULL,
                DATEADD(DAY, -30, @Ahora), DATEADD(DAY, 365, @Ahora), 1000, 5, 1),
               ('DEMOVENCIDO', N'Venció hace una semana (CUPON_VENCIDO)', 'MontoFijo', 25, NULL, 0, NULL,
                DATEADD(DAY, -60, @Ahora), DATEADD(DAY, -7, @Ahora), 100, 1, 1),
               ('DEMOFUTURO', N'Empieza dentro de un mes (CUPON_NO_VIGENTE_AUN)', 'MontoFijo', 25, NULL, 0, NULL,
                DATEADD(DAY, 30, @Ahora), DATEADD(DAY, 60, @Ahora), 100, 1, 1),
               ('DEMOINACTIVO', N'Desactivado por el Admin (CUPON_INACTIVO)', 'MontoFijo', 25, NULL, 0, NULL,
                DATEADD(DAY, -30, @Ahora), DATEADD(DAY, 365, @Ahora), 100, 1, 0),
               ('DEMOAGOTADO', N'Su único uso ya se consumió (CUPON_AGOTADO)', 'MontoFijo', @DescuentoCupon, NULL, 0, NULL,
                DATEADD(DAY, -@Dias - 10, @Ahora), DATEADD(DAY, 365, @Ahora), 1, 1, 1),
               ('DEMOUNAVEZ', N'Una vez por cliente; cliente@shopcart.gt ya lo usó (CUPON_LIMITE_CLIENTE)', 'MontoFijo',
                @DescuentoCupon, NULL, 0, NULL, DATEADD(DAY, -@Dias - 10, @Ahora), DATEADD(DAY, 365, @Ahora), 1000, 1, 1),
               ('DEMOMINIMO', N'Q50 en compras desde Q5,000 (CUPON_MINIMO_NO_ALCANZADO)', 'MontoFijo', 50, NULL, 5000,
                NULL, DATEADD(DAY, -30, @Ahora), DATEADD(DAY, 365, @Ahora), 1000, 3, 1),
               ('DEMOCATEGORIA', CONCAT(N'15 % solo en ', (SELECT c.Nombre FROM dbo.Categoria AS c
                                                            WHERE c.IDCategoria = @IDCategoriaCupon),
                                        N' (CUPON_SIN_PRODUCTOS_CATEGORIA)'),
                'Porcentaje', 15, NULL, 0, @IDCategoriaCupon, DATEADD(DAY, -30, @Ahora), DATEADD(DAY, 365, @Ahora),
                1000, 3, 1);

        -- El plan de pedidos: todo sale de un hash de (@Semilla, pedido, etiqueta), así es determinista.
        INSERT INTO @Plan (Orden, N, FechaPago, IDUsuario, Express, IDMunicipioN, Lineas, Base, Suerte, Cupon)
        SELECT ROW_NUMBER() OVER (ORDER BY x.FechaPago, n.N), n.N, x.FechaPago, c.IDUsuario,
               IIF(h.Metodo % 4 = 0, 1, 0), h.Municipio % @TotalMunicipios, 1 + h.Lineas % 3, h.Base % @TotalVariantes,
               IIF(n.N < 2, 50, h.Suerte % 100), CASE n.N WHEN 0 THEN 'DEMOAGOTADO' WHEN 1 THEN 'DEMOUNAVEZ' END
        FROM   @Numeros AS n
        CROSS APPLY (SELECT
            CHECKSUM(HASHBYTES('MD5', CONCAT(@Semilla, N'|', n.N, N'|fecha')))     & 2147483647 AS Fecha,
            CHECKSUM(HASHBYTES('MD5', CONCAT(@Semilla, N'|', n.N, N'|cliente')))   & 2147483647 AS Cliente,
            CHECKSUM(HASHBYTES('MD5', CONCAT(@Semilla, N'|', n.N, N'|metodo')))    & 2147483647 AS Metodo,
            CHECKSUM(HASHBYTES('MD5', CONCAT(@Semilla, N'|', n.N, N'|municipio'))) & 2147483647 AS Municipio,
            CHECKSUM(HASHBYTES('MD5', CONCAT(@Semilla, N'|', n.N, N'|lineas')))    & 2147483647 AS Lineas,
            CHECKSUM(HASHBYTES('MD5', CONCAT(@Semilla, N'|', n.N, N'|base')))      & 2147483647 AS Base,
            CHECKSUM(HASHBYTES('MD5', CONCAT(@Semilla, N'|', n.N, N'|suerte')))    & 2147483647 AS Suerte) AS h
        -- Al menos una hora de antigüedad, para que cada paso posterior quede en el pasado.
        CROSS APPLY (SELECT DATEADD(SECOND, -(3600 + h.Fecha % (@Dias * @SegundosPorDia - 3600)), @Ahora) AS FechaPago) AS x
        JOIN   @ClientesDemo AS c ON c.N = IIF(n.N = 1, -1, h.Cliente % @Clientes)
        WHERE  n.N < @Pedidos;

        -- El pedido con DEMOUNAVEZ es de cliente@shopcart.gt: así ese cliente ya no puede volver a usarlo.
        INSERT INTO @Plan (Orden, N, FechaPago, IDUsuario, Express, IDMunicipioN, Lineas, Base, Suerte, Cupon)
        SELECT 0, 1, DATEADD(DAY, -@Dias + 1, @Ahora), @IDClienteDemo, 0, 0, 1, 1, 50, 'DEMOUNAVEZ'
        WHERE  @Pedidos > 1;

        DECLARE @Orden INT = (SELECT MIN(p.Orden) FROM @Plan AS p),
                @N INT, @FechaPago DATETIME2(3), @IDUsuario INT, @Express BIT, @IDMunicipioN INT, @Lineas INT,
                @Base INT, @Suerte INT, @Cupon VARCHAR(30), @Edad INT, @Destino VARCHAR(20),
                @IDMetodo INT, @NombreMetodo NVARCHAR(50), @Costo DECIMAL(12,2), @DiasMin TINYINT, @DiasMax TINYINT,
                @Subtotal DECIMAL(12,2), @Descuento DECIMAL(12,2), @CostoEnvio DECIMAL(12,2), @Total DECIMAL(12,2),
                @BaseImponible DECIMAL(12,2), @IDCupon INT, @IDCarrito INT, @IDSesion INT, @IDIntento BIGINT, @IDPedido INT,
                @IDTransaccion VARCHAR(64), @FechaLocal DATE, @Estado INT, @Nombre NVARCHAR(100),
                @IDMunicipio INT, @Municipio NVARCHAR(80), @Departamento NVARCHAR(50), @FechaEvento DATETIME2(3),
                @IDDevolucion INT, @MontoDevolucion DECIMAL(12,2), @Numero VARCHAR(20),
                @LlaveIntento UNIQUEIDENTIFIER, @LlaveReembolso UNIQUEIDENTIFIER, @IDReembolsoPasarela VARCHAR(64);

        WHILE @Orden IS NOT NULL
        BEGIN
            SELECT @N = p.N, @FechaPago = p.FechaPago, @IDUsuario = p.IDUsuario, @Express = p.Express,
                   @IDMunicipioN = p.IDMunicipioN, @Lineas = p.Lineas, @Base = p.Base, @Suerte = p.Suerte,
                   @Cupon = p.Cupon
            FROM   @Plan AS p WHERE p.Orden = @Orden;
            -- La compra (y el uso del cupón) la registra su cliente.
            EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuario, 'Sistema', @RequestId;

            SET @Edad = DATEDIFF(SECOND, @FechaPago, @Ahora) / @SegundosPorDia;
            -- 6 % cancelados; con más de 8 días, 4 % con devolución (uno total, tres parciales); el resto avanza por
            -- su ciclo según su antigüedad.
            SET @Destino = CASE WHEN @Suerte < 6 THEN 'Cancelado'
                                WHEN @Edad < 1 THEN 'Pagado'
                                WHEN @Edad < 2 THEN 'EnPreparacion'
                                WHEN @Edad < 5 THEN 'Despachado'
                                WHEN @Edad >= 8 AND @Suerte = 6 THEN 'DevolucionTotal'
                                WHEN @Edad >= 8 AND @Suerte BETWEEN 7 AND 9 THEN 'DevolucionParcial'
                                ELSE 'Entregado' END;

            SELECT @IDMetodo = m.IDMetodoEnvio, @NombreMetodo = m.Nombre, @Costo = m.Costo, @DiasMin = m.DiasMin,
                   @DiasMax = m.DiasMax
            FROM   dbo.MetodoEnvio AS m WHERE m.Codigo = IIF(@Express = 1, 'Express', 'Estandar');
            SELECT @IDMunicipio = m.IDMunicipio, @Municipio = m.Municipio, @Departamento = m.Departamento
            FROM   @Municipios AS m WHERE m.N = @IDMunicipioN;
            SET @Nombre = (SELECT u.Nombre FROM dbo.Usuario AS u WHERE u.IDUsuario = @IDUsuario);

            -- Líneas distintas: saltos de @SaltoVariante desde una base al azar; el cupón (si hay) va en la primera.
            DELETE FROM @LineasPedido;
            INSERT INTO @LineasPedido (Linea, IDVarianteN, Cantidad, Descuento, ADevolver)
            SELECT k.N, (@Base + k.N * @SaltoVariante) % @TotalVariantes,
                   1 + (CHECKSUM(HASHBYTES('MD5', CONCAT(@Semilla, N'|', @N, N'|cantidad|', k.N))) & 2147483647) % 3,
                   IIF(k.N = 0 AND @Cupon IS NOT NULL, @DescuentoCupon, 0), 0
            FROM   @Numeros AS k WHERE k.N < @Lineas;
            -- Devolución total: todo; parcial: una unidad de la primera línea.
            UPDATE @LineasPedido
            SET    ADevolver = CASE WHEN @Destino = 'DevolucionTotal' THEN Cantidad
                                    WHEN @Destino = 'DevolucionParcial' AND Linea = 0 THEN 1 ELSE 0 END;
            IF @Destino = 'DevolucionParcial'
               AND NOT EXISTS (SELECT 1 FROM @LineasPedido AS l WHERE l.ADevolver < l.Cantidad)
                SET @Destino = 'DevolucionTotal';

            SELECT @Subtotal = SUM(l.Cantidad * v.Precio), @Descuento = SUM(l.Descuento)
            FROM   @LineasPedido AS l JOIN @Variantes AS v ON v.N = l.IDVarianteN;
            SET @CostoEnvio = IIF(@EnvioGratis IS NOT NULL AND @Subtotal - @Descuento >= @EnvioGratis, 0, @Costo);
            SET @Total = @Subtotal - @Descuento + @CostoEnvio;
            -- N-18: precios con IVA incluido.
            SET @BaseImponible = ROUND(@Total / 1.12, 2);
            SET @FechaLocal = (SELECT f.FechaLocal FROM dbo.FU_Sistema_FechaLocal(@FechaPago) AS f);
            SET @IDCupon = (SELECT c.IDCupon FROM dbo.Cupon AS c WHERE c.Codigo = @Cupon);
            SET @IDTransaccion = CONCAT('DEMO-',
                                        CONVERT(VARCHAR(32), HASHBYTES('MD5', CONCAT(@Semilla, N'|', @N, N'|transaccion')), 2));
            SET @LlaveIntento = CONVERT(UNIQUEIDENTIFIER, HASHBYTES('MD5', CONCAT(@Semilla, N'|', @N, N'|pago')));
            SET @Estado = CASE @Destino WHEN 'Cancelado' THEN @IDCancelado WHEN 'Pagado' THEN @IDPagado
                                        WHEN 'EnPreparacion' THEN @IDEnPreparacion WHEN 'Despachado' THEN @IDDespachado
                                        WHEN 'DevolucionTotal' THEN @IDDevuelto
                                        WHEN 'DevolucionParcial' THEN @IDDevueltoParcial ELSE @IDEntregado END;

            INSERT INTO dbo.Carrito (IDUsuario, Estado, FechaUltimaActividad, FechaCierre, FechaCreacion)
            VALUES (@IDUsuario, 'Convertido', DATEADD(MINUTE, -10, @FechaPago), @FechaPago, DATEADD(MINUTE, -30, @FechaPago));
            SET @IDCarrito = SCOPE_IDENTITY();

            INSERT INTO dbo.SesionCheckout (IDUsuario, IDCarrito, Estado, HashContenido, NombreRecibe, TelefonoRecibe,
                                            IDMunicipio, Departamento, Municipio, DireccionLinea, Referencia, IDMetodoEnvio,
                                            NombreMetodoEnvio, DiasMin, DiasMax, IDCupon, CodigoCupon, Subtotal, Descuento,
                                            CostoEnvio, Total, FechaExpiracion, FechaCierre, FechaCreacion)
            VALUES (@IDUsuario, @IDCarrito, 'Pagada', HASHBYTES('SHA2_256', CONCAT(N'demo|', @N)), @Nombre, '55550000',
                    @IDMunicipio, @Departamento, @Municipio, N'Calle demo ' + CONVERT(NVARCHAR(10), @N), NULL, @IDMetodo,
                    @NombreMetodo, @DiasMin, @DiasMax, @IDCupon, @Cupon, @Subtotal, @Descuento, @CostoEnvio, @Total,
                    DATEADD(MINUTE, 10, @FechaPago), @FechaPago, DATEADD(MINUTE, -5, @FechaPago));
            SET @IDSesion = SCOPE_IDENTITY();

            INSERT INTO dbo.IntentoPago (IDSesionCheckout, LlaveIdempotencia, HashSolicitud, Monto, Estado,
                                         IDTransaccionPasarela, MarcaTarjeta, UltimosDigitos, FechaCreacion,
                                         FechaActualizacion)
            VALUES (@IDSesion, @LlaveIntento, HASHBYTES('SHA2_256', CONCAT(N'demo-pago|', @N)), @Total, 'Capturado',
                    @IDTransaccion, 'Visa', '4242', @FechaPago, @FechaPago);
            SET @IDIntento = SCOPE_IDENTITY();
            INSERT INTO dbo.PasarelaAutorizacion (LlaveIdempotencia, IDTransaccion, Monto, Marca, UltimosDigitos, Estado,
                                                  CodigoRespuesta, FechaCreacion, FechaActualizacion)
            VALUES (@LlaveIntento, @IDTransaccion, @Total, 'Visa', '4242', 'Capturada', NULL, @FechaPago, @FechaPago);

            INSERT INTO dbo.Pedido (IDUsuario, IDSesionCheckout, IDIntentoPago, IDEstadoPedido, Subtotal, Descuento,
                                    CostoEnvio, Total, BaseImponible, IVA, IDCupon, CodigoCupon, IDMetodoEnvio,
                                    NombreMetodoEnvio, FechaEstimadaEntrega, NombreRecibe, TelefonoRecibe, IDMunicipio,
                                    Departamento, Municipio, DireccionLinea, Referencia, IDTransaccionPasarela,
                                    MarcaTarjeta, UltimosDigitos, FechaPago, FechaPagoLocal, FechaCreacion)
            VALUES (@IDUsuario, @IDSesion, @IDIntento, @Estado, @Subtotal, @Descuento, @CostoEnvio, @Total, @BaseImponible,
                    @Total - @BaseImponible, @IDCupon, @Cupon, @IDMetodo, @NombreMetodo, DATEADD(DAY, @DiasMax, @FechaLocal),
                    @Nombre, '55550000', @IDMunicipio, @Departamento, @Municipio,
                    N'Calle demo ' + CONVERT(NVARCHAR(10), @N), NULL, @IDTransaccion, 'Visa', '4242', @FechaPago,
                    @FechaLocal, @FechaPago);
            SET @IDPedido = SCOPE_IDENTITY();
            SET @Numero = (SELECT p.NumeroPedido FROM dbo.Pedido AS p WHERE p.IDPedido = @IDPedido);

            INSERT INTO dbo.DetallePedido (IDPedido, IDVariante, IDPrecioVariante, SKU, NombreProducto,
                                           DescripcionVariante, IDCategoria, NombreCategoria, Cantidad, PrecioUnitario,
                                           DescuentoLinea, TotalLinea, FechaCreacion)
            SELECT @IDPedido, v.IDVariante, v.IDPrecioVariante, v.SKU, v.Producto, v.Descripcion, v.IDCategoria,
                   v.Categoria, l.Cantidad, v.Precio, l.Descuento, l.Cantidad * v.Precio - l.Descuento, @FechaPago
            FROM   @LineasPedido AS l JOIN @Variantes AS v ON v.N = l.IDVarianteN;

            IF @IDCupon IS NOT NULL
            BEGIN
                INSERT INTO dbo.UsoCupon (IDCupon, IDUsuario, IDSesionCheckout, IDPedido, Estado, MontoDescuento,
                                          FechaCreacion, FechaActualizacion)
                VALUES (@IDCupon, @IDUsuario, @IDSesion, @IDPedido, 'Confirmado', @Descuento, @FechaPago, @FechaPago);
                UPDATE dbo.Cupon SET UsosComprometidos = UsosComprometidos + 1 WHERE IDCupon = @IDCupon;
            END

            -- N-08: el historial con la fecha real de cada paso (la primera fila la registra el cliente al pagar).
            INSERT INTO dbo.HistorialEstadoPedido (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Motivo, Fecha)
            VALUES (@IDPedido, NULL, @IDPagado, @IDUsuario, N'Pago confirmado', @FechaPago);
            INSERT INTO @Eventos (Fecha, Tipo, IDPedido) VALUES (@FechaPago, 'Venta', @IDPedido);

            IF @Destino = 'Cancelado'
            BEGIN
                SET @FechaEvento = DATEADD(MINUTE, 30, @FechaPago);
                INSERT INTO dbo.HistorialEstadoPedido (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Motivo, Fecha)
                VALUES (@IDPedido, @IDPagado, @IDCancelado, @IDUsuario, N'Ya no lo necesito', @FechaEvento);
                SET @LlaveReembolso = CONVERT(UNIQUEIDENTIFIER,
                                              HASHBYTES('MD5', CONCAT(N'Reembolso|', @IDPedido, N'|Cancelacion')));
                SET @IDReembolsoPasarela = CONCAT('DEMOR-', @IDPedido);
                INSERT INTO dbo.Reembolso (IDPedido, IDDevolucion, Origen, Monto, Estado, LlaveIdempotencia,
                                           IDTransaccionReembolso, FechaCompletado, FechaCreacion, FechaActualizacion)
                VALUES (@IDPedido, NULL, 'Cancelacion', @Total, 'Completado', @LlaveReembolso,
                        @IDReembolsoPasarela, @FechaEvento, @FechaEvento, @FechaEvento);
                INSERT INTO dbo.PasarelaReembolso (LlaveIdempotencia, IDTransaccion, IDReembolso, Monto, FechaCreacion)
                VALUES (@LlaveReembolso, @IDTransaccion, @IDReembolsoPasarela, @Total, @FechaEvento);
                UPDATE dbo.Pedido SET MontoReembolsado = @Total WHERE IDPedido = @IDPedido;
                INSERT INTO @Eventos (Fecha, Tipo, IDPedido) VALUES (@FechaEvento, 'Cancelacion', @IDPedido);
            END
            ELSE IF @Destino <> 'Pagado'
            BEGIN
                INSERT INTO dbo.HistorialEstadoPedido (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Fecha)
                VALUES (@IDPedido, @IDPagado, @IDEnPreparacion, @IDOperador, DATEADD(HOUR, 4, @FechaPago));
                IF @Destino <> 'EnPreparacion'
                    INSERT INTO dbo.HistorialEstadoPedido (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Fecha)
                    VALUES (@IDPedido, @IDEnPreparacion, @IDDespachado, @IDOperador, DATEADD(DAY, 1, @FechaPago));
                IF @Destino NOT IN ('EnPreparacion', 'Despachado')
                    INSERT INTO dbo.HistorialEstadoPedido (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Fecha)
                    VALUES (@IDPedido, @IDDespachado, @IDEntregado, @IDOperador, DATEADD(DAY, 4, @FechaPago));
            END

            IF @Destino IN ('DevolucionTotal', 'DevolucionParcial')
            BEGIN
                -- N-10: misma regla que SP_Pedidos_RegistrarDevolucion (por unidad al centavo hacia abajo; la que
                -- completa la línea se lleva el residuo).
                SET @FechaEvento = DATEADD(DAY, 7, @FechaPago);
                SELECT @MontoDevolucion = SUM(CASE WHEN l.ADevolver = d.Cantidad THEN d.TotalLinea
                                                   ELSE l.ADevolver * FLOOR(d.TotalLinea * 100 / d.Cantidad) / 100 END)
                FROM   @LineasPedido AS l
                JOIN   @Variantes AS v ON v.N = l.IDVarianteN
                JOIN   dbo.DetallePedido AS d ON d.IDPedido = @IDPedido AND d.IDVariante = v.IDVariante
                WHERE  l.ADevolver > 0;

                INSERT INTO dbo.Devolucion (IDPedido, IDUsuario, Motivo, MontoReembolso, Fecha, FechaLocal, FechaCreacion)
                SELECT @IDPedido, @IDOperador, N'El cliente devolvió el producto', @MontoDevolucion, @FechaEvento,
                       f.FechaLocal, @FechaEvento
                FROM   dbo.FU_Sistema_FechaLocal(@FechaEvento) AS f;
                SET @IDDevolucion = SCOPE_IDENTITY();

                INSERT INTO dbo.DetalleDevolucion (IDDevolucion, IDDetallePedido, Cantidad, MontoReembolso, FechaCreacion)
                SELECT @IDDevolucion, d.IDDetallePedido, l.ADevolver,
                       CASE WHEN l.ADevolver = d.Cantidad THEN d.TotalLinea
                            ELSE l.ADevolver * FLOOR(d.TotalLinea * 100 / d.Cantidad) / 100 END, @FechaEvento
                FROM   @LineasPedido AS l
                JOIN   @Variantes AS v ON v.N = l.IDVarianteN
                JOIN   dbo.DetallePedido AS d ON d.IDPedido = @IDPedido AND d.IDVariante = v.IDVariante
                WHERE  l.ADevolver > 0;

                UPDATE d SET d.CantidadDevuelta = dd.Cantidad
                FROM   dbo.DetallePedido AS d
                JOIN   dbo.DetalleDevolucion AS dd ON dd.IDDetallePedido = d.IDDetallePedido
                WHERE  dd.IDDevolucion = @IDDevolucion;

                INSERT INTO dbo.HistorialEstadoPedido (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Motivo, Fecha)
                VALUES (@IDPedido, @IDEntregado, @Estado, @IDOperador, N'El cliente devolvió el producto', @FechaEvento);
                SET @LlaveReembolso = CONVERT(UNIQUEIDENTIFIER,
                                              HASHBYTES('MD5', CONCAT(N'Reembolso|', @IDPedido, N'|Devolucion|', @IDDevolucion)));
                SET @IDReembolsoPasarela = CONCAT('DEMOR-', @IDPedido, '-', @IDDevolucion);
                INSERT INTO dbo.Reembolso (IDPedido, IDDevolucion, Origen, Monto, Estado, LlaveIdempotencia,
                                           IDTransaccionReembolso, FechaCompletado, FechaCreacion, FechaActualizacion)
                VALUES (@IDPedido, @IDDevolucion, 'Devolucion', @MontoDevolucion, 'Completado', @LlaveReembolso,
                        @IDReembolsoPasarela, @FechaEvento, @FechaEvento, @FechaEvento);
                INSERT INTO dbo.PasarelaReembolso (LlaveIdempotencia, IDTransaccion, IDReembolso, Monto, FechaCreacion)
                VALUES (@LlaveReembolso, @IDTransaccion, @IDReembolsoPasarela, @MontoDevolucion, @FechaEvento);
                UPDATE dbo.Pedido SET MontoReembolsado = @MontoDevolucion WHERE IDPedido = @IDPedido;
                INSERT INTO @Eventos (Fecha, Tipo, IDPedido, IDDevolucion)
                VALUES (@FechaEvento, 'Devolucion', @IDPedido, @IDDevolucion);
            END

            SET @Orden = (SELECT MIN(p.Orden) FROM @Plan AS p WHERE p.Orden > @Orden);
        END

        -- La existencia inicial de cada variante vendida: lo que vende el periodo más un margen, antes del periodo.
        INSERT INTO @Eventos (Fecha, Tipo, IDVariante, Cantidad)
        SELECT DATEADD(DAY, -@Dias - 1, @Ahora), 'Entrada', d.IDVariante, SUM(d.Cantidad) + @MargenExistencia
        FROM   dbo.DetallePedido AS d
        JOIN   dbo.Pedido AS p ON p.IDPedido = d.IDPedido
        WHERE  p.IDTransaccionPasarela LIKE 'DEMO-%'
        GROUP BY d.IDVariante;

        -- N-07: el kardex en orden cronológico, cada movimiento con la fecha de su evento.
        DECLARE @Tipo VARCHAR(12), @IDVariante INT, @Cantidad INT, @CodigoMovimiento VARCHAR(30), @Actor INT;
        DECLARE @Orden2 TABLE (Posicion INT PRIMARY KEY, IDEvento INT NOT NULL);
        INSERT INTO @Orden2 (Posicion, IDEvento)
        SELECT ROW_NUMBER() OVER (ORDER BY e.Fecha, e.ID), e.ID FROM @Eventos AS e;
        DECLARE @Posicion INT = 1, @UltimaPosicion INT = (SELECT MAX(o.Posicion) FROM @Orden2 AS o);

        WHILE @Posicion <= @UltimaPosicion
        BEGIN
            SELECT @FechaEvento = e.Fecha, @Tipo = e.Tipo, @IDPedido = e.IDPedido, @IDDevolucion = e.IDDevolucion,
                   @IDVariante = e.IDVariante, @Cantidad = e.Cantidad
            FROM   @Orden2 AS o JOIN @Eventos AS e ON e.ID = o.IDEvento
            WHERE  o.Posicion = @Posicion;
            SET @Numero = (SELECT p.NumeroPedido FROM dbo.Pedido AS p WHERE p.IDPedido = @IDPedido);
            SET @Actor = CASE @Tipo WHEN 'Entrada' THEN @IDAdmin
                                    WHEN 'Devolucion' THEN @IDOperador
                                    ELSE (SELECT p.IDUsuario FROM dbo.Pedido AS p WHERE p.IDPedido = @IDPedido) END;
            EXEC dbo.SP_Sistema_EstablecerContexto @Actor, 'Sistema', @RequestId;
            SET @CodigoMovimiento = CASE @Tipo WHEN 'Venta' THEN 'SalidaVenta'
                                               WHEN 'Cancelacion' THEN 'ReingresoCancelacion'
                                               ELSE 'ReingresoDevolucion' END;

            IF @Tipo = 'Entrada'
                EXEC dbo.SP_Inventario_RegistrarMovimiento
                     @IDVariante = @IDVariante, @CodigoTipo = 'EntradaCompra', @Cantidad = @Cantidad,
                     @Motivo = N'Inventario inicial de los datos demo', @Referencia = NULL, @IDPedido = NULL,
                     @IDDevolucion = NULL, @FechaMovimiento = @FechaEvento;
            ELSE
            BEGIN
                -- Línea por línea en orden de IDVariante, como los SPs de pedidos.
                SET @IDVariante = (SELECT MIN(d.IDVariante) FROM dbo.DetallePedido AS d WHERE d.IDPedido = @IDPedido);
                WHILE @IDVariante IS NOT NULL
                BEGIN
                    SET @Cantidad = CASE @Tipo
                        WHEN 'Devolucion' THEN (SELECT dd.Cantidad FROM dbo.DetalleDevolucion AS dd
                                                JOIN dbo.DetallePedido AS d ON d.IDDetallePedido = dd.IDDetallePedido
                                                WHERE dd.IDDevolucion = @IDDevolucion AND d.IDVariante = @IDVariante)
                        ELSE (SELECT d.Cantidad FROM dbo.DetallePedido AS d
                              WHERE d.IDPedido = @IDPedido AND d.IDVariante = @IDVariante) END;
                    IF @Cantidad IS NOT NULL
                        EXEC dbo.SP_Inventario_RegistrarMovimiento
                             @IDVariante = @IDVariante, @CodigoTipo = @CodigoMovimiento,
                             @Cantidad = @Cantidad, @Motivo = N'Datos demo', @Referencia = @Numero,
                             @IDPedido = @IDPedido, @IDDevolucion = @IDDevolucion, @FechaMovimiento = @FechaEvento;
                    SET @IDVariante = (SELECT MIN(d.IDVariante) FROM dbo.DetallePedido AS d
                                       WHERE d.IDPedido = @IDPedido AND d.IDVariante > @IDVariante);
                END
            END
            SET @Posicion += 1;
        END

        -- N-13: carritos abandonados de clientes demo distintos (sin otro carrito Activo), con 2+ días sin cambios.
        INSERT INTO dbo.Carrito (IDUsuario, Estado, FechaUltimaActividad, FechaCreacion)
        SELECT c.IDUsuario, 'Activo', x.Fecha, x.Fecha
        FROM   @Numeros AS k
        JOIN   @ClientesDemo AS c ON c.N = (k.N * 5) % @Clientes
        CROSS APPLY (SELECT DATEADD(SECOND,
                                    -(2 * @SegundosPorDia
                                      + (CHECKSUM(HASHBYTES('MD5', CONCAT(@Semilla, N'|', k.N, N'|abandono'))) & 2147483647)
                                        % ((@Dias - 3) * @SegundosPorDia)), @Ahora) AS Fecha) AS x
        WHERE  k.N < @CarritosAbandonados;

        INSERT INTO dbo.LineaCarrito (IDCarrito, IDVariante, Cantidad, IDPrecioVarianteGarantizado, FechaGarantiaHasta,
                                      FechaAgregado, FechaCreacion, FechaActualizacion)
        SELECT ca.IDCarrito, v.IDVariante, 1 + (ca.IDCarrito + j.N) % 2, v.IDPrecioVariante,
               DATEADD(DAY, 3, ca.FechaUltimaActividad), ca.FechaUltimaActividad, ca.FechaUltimaActividad,
               ca.FechaUltimaActividad
        FROM   dbo.Carrito AS ca
        JOIN   @ClientesDemo AS c ON c.IDUsuario = ca.IDUsuario
        CROSS JOIN @Numeros AS j
        JOIN   @Variantes AS v ON v.N = (ca.IDCarrito * 3 + j.N * @SaltoVariante) % @TotalVariantes
        WHERE  ca.Estado = 'Activo' AND j.N < 2;

        -- N-07: lo generado debe cuadrar; si no, nada se confirma.
        IF EXISTS (SELECT 1 FROM dbo.VW_Inventario_Conciliacion AS c
                   WHERE EXISTS (SELECT 1 FROM @Eventos AS e WHERE e.IDVariante = c.IDVariante))
            THROW 50005, N'Los datos demo dejaron el inventario sin conciliar.', 1;

        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH

    SELECT (SELECT COUNT(*) FROM dbo.Pedido AS p WHERE p.IDTransaccionPasarela LIKE 'DEMO-%') AS Pedidos,
           (SELECT COUNT(*) FROM @ClientesDemo) AS Clientes,
           (SELECT COUNT(*) FROM @Eventos) AS Eventos;
END
GO
