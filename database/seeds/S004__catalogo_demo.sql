-- S004: catálogo demo de una cadena de ropa, calzado y accesorios en Guatemala (E1-H06).
-- Precios en quetzales con IVA incluido. Las variantes nacen sin existencia y toda existencia inicial
-- entra con SP_Inventario_RegistrarMovimiento, así VW_Inventario_Conciliacion queda vacía (N-07).
-- La semilla actúa como el administrador demo: el kardex y la bitácora lo registran como autor.
-- El migrador corre el script dentro de una transacción, que es la que exige el SP interno.

DECLARE @IDAdmin INT = (SELECT IDUsuario FROM dbo.Usuario WHERE CorreoNormalizado = N'admin@shopcart.gt');
DECLARE @FechaInicial DATETIME2(3) = DATEADD(DAY, -90, SYSUTCDATETIME());
DECLARE @FechaCambioPrecio DATETIME2(3) = DATEADD(DAY, -20, SYSUTCDATETIME());

EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor = @IDAdmin, @RolActor = 'Administrador';

DECLARE @Categoria TABLE (
    Prefijo     VARCHAR(3)    NOT NULL PRIMARY KEY,
    Nombre      NVARCHAR(80)  NOT NULL,
    Descripcion NVARCHAR(300) NOT NULL,
    Imagen      NVARCHAR(100) NOT NULL
);
INSERT INTO @Categoria (Prefijo, Nombre, Descripcion, Imagen) VALUES
    ('CAM', N'Camisas y blusas',     N'Camisas, blusas, camisetas y polos para todos los días.', N'camisas-y-blusas.svg'),
    ('PAN', N'Pantalones',           N'Jeans, chinos, pantalones de vestir y shorts.',           N'pantalones.svg'),
    ('VES', N'Vestidos y faldas',    N'Vestidos casuales y de fiesta, faldas de todos los largos.', N'vestidos-y-faldas.svg'),
    ('CHA', N'Chaquetas y suéteres', N'Chaquetas, suéteres, sudaderos y blazers.',               N'chaquetas-y-sueteres.svg'),
    ('CAL', N'Calzado',              N'Tenis, botas, sandalias y zapatos formales.',             N'calzado.svg'),
    ('DEP', N'Ropa deportiva',       N'Ropa para correr, entrenar y hacer deporte.',             N'ropa-deportiva.svg'),
    ('ACC', N'Accesorios',           N'Gorras, cinchos, bolsos, mochilas y más.',                N'accesorios.svg'),
    ('INF', N'Infantil',             N'Ropa para niñas y niños de 2 a 12 años.',                 N'infantil.svg');

-- Un solo atributo Talla para todas las categorías: cada producto usa su rango (S–XL, 28–38, 36–44, 2–12).
DECLARE @Talla TABLE (Valor NVARCHAR(50) NOT NULL PRIMARY KEY, Orden SMALLINT NOT NULL);
INSERT INTO @Talla (Valor, Orden) VALUES
    (N'2', 1), (N'4', 2), (N'6', 3), (N'8', 4), (N'10', 5), (N'12', 6),
    (N'S', 7), (N'M', 8), (N'L', 9), (N'XL', 10),
    (N'28', 11), (N'30', 12), (N'32', 13), (N'34', 14), (N'36', 15), (N'37', 16), (N'38', 17),
    (N'39', 18), (N'40', 19), (N'41', 20), (N'42', 21), (N'43', 22), (N'44', 23);

-- Codigo: parte del SKU.
DECLARE @Color TABLE (Valor NVARCHAR(50) NOT NULL PRIMARY KEY, Codigo VARCHAR(3) NOT NULL UNIQUE, Orden SMALLINT NOT NULL);
INSERT INTO @Color (Valor, Codigo, Orden) VALUES
    (N'Negro', 'NEG', 1), (N'Blanco', 'BLA', 2), (N'Gris', 'GRI', 3), (N'Azul', 'AZU', 4),
    (N'Azul marino', 'MAR', 5), (N'Celeste', 'CEL', 6), (N'Rojo', 'ROJ', 7), (N'Vino', 'VIN', 8),
    (N'Rosado', 'ROS', 9), (N'Verde', 'VER', 10), (N'Mostaza', 'MOS', 11), (N'Beige', 'BEI', 12),
    (N'Café', 'CAF', 13);

-- Tallas y Colores: listas separadas por coma; las variantes son su combinación.
-- SKUFijo: la única variante del producto usa ese SKU (DEMO-CONCURRENCIA, para la demo de RF-06).
DECLARE @Producto TABLE (
    Codigo      VARCHAR(6)     NOT NULL PRIMARY KEY,
    Nombre      NVARCHAR(150)  NOT NULL UNIQUE,
    Descripcion NVARCHAR(2000) NOT NULL,
    Precio      DECIMAL(12,2)  NOT NULL,
    Tallas      NVARCHAR(100)  NULL,
    Colores     NVARCHAR(100)  NOT NULL,
    Activo      BIT            NOT NULL,
    SKUFijo     VARCHAR(40)    NULL
);
INSERT INTO @Producto (Codigo, Nombre, Descripcion, Precio, Tallas, Colores, Activo, SKUFijo) VALUES
    ('CAM-01', N'Camisa Oxford manga larga',          N'Camisa de algodón Oxford con cuello abotonado.',             249.00, N'S,M,L,XL', N'Blanco', 1, NULL),
    ('CAM-02', N'Camisa de lino manga corta',         N'Camisa fresca de lino, ideal para la costa.',                279.00, N'M,L,XL',   N'Beige', 1, NULL),
    ('CAM-03', N'Blusa de algodón con bordado típico', N'Blusa con bordado inspirado en los huipiles de Sololá.',    329.00, N'S,M,L',    N'Blanco', 1, NULL),
    ('CAM-04', N'Camiseta básica cuello redondo',     N'Camiseta 100 % algodón peinado.',                             79.00, N'S,M,L,XL', N'Negro,Blanco', 1, NULL),
    ('CAM-05', N'Polo piqué',                         N'Polo de algodón piqué con botones al tono.',                 149.00, N'S,M,L,XL', N'Azul marino', 1, NULL),
    ('CAM-06', N'Blusa de chifón estampada',          N'Blusa ligera de chifón con estampado floral.',               229.00, N'S,M,L',    N'Rosado', 1, NULL),
    ('CAM-07', N'Camisa de cuadros de franela',       N'Camisa abrigadora de franela a cuadros.',                    259.00, N'M,L,XL',   N'Rojo', 0, NULL),
    ('CAM-08', N'Camiseta gráfica Volcán de Agua',    N'Camiseta con ilustración del Volcán de Agua.',               119.00, N'S,M,L',    N'Negro', 1, NULL),

    ('PAN-01', N'Jeans corte recto',                  N'Jeans de mezclilla con corte recto clásico.',                349.00, N'30,32,34,36',    N'Azul', 1, NULL),
    ('PAN-02', N'Jeans skinny',                       N'Jeans ajustados de mezclilla elástica.',                     379.00, N'28,30,32,34',    N'Negro', 1, NULL),
    ('PAN-03', N'Pantalón chino',                     N'Pantalón chino de gabardina.',                               299.00, N'30,32,34,36',    N'Beige,Azul marino', 1, NULL),
    ('PAN-04', N'Pantalón de vestir',                 N'Pantalón formal de casimir con pliegue.',                    399.00, N'30,32,34,36,38', N'Gris', 1, NULL),
    ('PAN-05', N'Jogger de algodón',                  N'Jogger cómodo con puños elásticos.',                         199.00, N'28,30,32,34',    N'Gris', 1, NULL),
    ('PAN-06', N'Pantalón cargo',                     N'Pantalón cargo con bolsas laterales.',                       329.00, N'30,32,34',       N'Verde', 1, NULL),
    ('PAN-07', N'Short de mezclilla',                 N'Short de mezclilla deslavada.',                              149.00, N'28,30,32',       N'Celeste', 0, NULL),

    ('VES-01', N'Vestido floral de verano',           N'Vestido corto de algodón con estampado floral.',             289.00, N'S,M,L',    N'Rosado', 1, NULL),
    ('VES-02', N'Vestido negro de coctel',            N'Vestido entallado para ocasiones especiales.',               549.00, N'S,M,L',    N'Negro', 1, NULL),
    ('VES-03', N'Vestido camisero de lino',           N'Vestido camisero de lino con cinturón.',                     429.00, N'S,M,L,XL', N'Beige', 1, NULL),
    ('VES-04', N'Falda midi plisada',                 N'Falda plisada a media pierna.',                              259.00, N'S,M,L',    N'Vino', 1, NULL),
    ('VES-05', N'Falda de mezclilla',                 N'Falda corta de mezclilla con botones.',                      199.00, N'S,M,L',    N'Azul', 1, NULL),
    ('VES-06', N'Vestido largo con estampado típico', N'Vestido largo con estampado inspirado en tejidos de Chichicastenango.', 649.00, N'S,M,L', N'Azul marino,Rojo', 1, NULL),
    ('VES-07', N'Falda corta de corte A',             N'Falda de corte A de gabardina.',                             179.00, N'S,M,L',    N'Negro', 1, NULL),

    ('CHA-01', N'Chaqueta de cuero genuino',          N'Chaqueta de cuero de res curtido en Guatemala.',             899.00, N'S,M,L,XL', N'Negro,Café', 1, NULL),
    ('CHA-02', N'Chaqueta de mezclilla',              N'Chaqueta clásica de mezclilla.',                             449.00, N'S,M,L,XL', N'Azul', 1, NULL),
    ('CHA-03', N'Suéter de lana tejido',              N'Suéter de lana tejido a mano en Momostenango.',              379.00, N'S,M,L',    N'Gris,Mostaza', 1, NULL),
    ('CHA-04', N'Sudadero con capucha',               N'Sudadero de algodón perchado con capucha.',                  299.00, N'S,M,L,XL', N'Negro,Gris', 1, NULL),
    ('CHA-05', N'Cárdigan de punto',                  N'Cárdigan ligero de punto con botones.',                      329.00, N'S,M,L',    N'Beige', 1, NULL),
    ('CHA-06', N'Chaqueta impermeable ligera',        N'Chaqueta impermeable para la temporada de lluvia.',          499.00, N'M,L,XL',   N'Verde', 1, NULL),
    ('CHA-07', N'Chaleco acolchado',                  N'Chaleco acolchado sin mangas.',                              399.00, N'S,M,L',    N'Azul marino', 1, NULL),
    ('CHA-08', N'Blazer casual',                      N'Blazer de corte moderno sin forro.',                         699.00, N'S,M,L,XL', N'Azul marino', 1, NULL),

    ('CAL-01', N'Tenis urbanos de lona',              N'Tenis de lona con suela de hule.',                           299.00, N'38,39,40,41,42', N'Blanco', 1, NULL),
    ('CAL-02', N'Botas de cuero para trabajo',        N'Botas de cuero con punta reforzada.',                        799.00, N'39,40,41,42,43', N'Café', 1, NULL),
    ('CAL-03', N'Sandalias de cuero artesanales',     N'Sandalias de cuero hechas a mano en Pastores.',              189.00, N'36,37,38,39',    N'Café', 1, NULL),
    ('CAL-04', N'Zapatos formales Oxford',            N'Zapatos Oxford de cuero liso.',                              649.00, N'39,40,41,42',    N'Negro', 1, NULL),
    ('CAL-05', N'Zapatillas de ballet',               N'Zapatillas planas de piel sintética.',                       229.00, N'36,37,38,39',    N'Negro,Beige', 1, NULL),
    ('CAL-06', N'Tenis para correr',                  N'Tenis ligeros con amortiguación.',                           599.00, N'40,41,42,43',    N'Gris', 1, NULL),
    ('CAL-07', N'Botines de tacón bajo',              N'Botines de piel sintética con tacón de 4 cm.',               549.00, N'36,37,38',       N'Negro', 1, NULL),
    ('CAL-08', N'Mocasines de gamuza',                N'Mocasines de gamuza con suela flexible.',                    499.00, N'40,41,42',       N'Azul marino', 1, NULL),

    ('DEP-01', N'Camiseta deportiva de secado rápido', N'Camiseta de poliéster transpirable.',                       139.00, N'S,M,L,XL', N'Negro,Azul', 1, NULL),
    ('DEP-02', N'Leggings deportivos',                N'Leggings de compresión con cintura alta.',                   199.00, N'S,M,L',    N'Negro', 1, NULL),
    ('DEP-03', N'Short deportivo',                    N'Short ligero con forro interior.',                             99.00, N'S,M,L,XL', N'Negro', 1, NULL),
    ('DEP-04', N'Sudadera deportiva con cierre',      N'Sudadera técnica con cierre completo.',                      349.00, N'M,L,XL',   N'Gris', 1, NULL),
    ('DEP-05', N'Top deportivo',                      N'Top de soporte medio.',                                      159.00, N'S,M,L',    N'Rosado', 1, NULL),
    ('DEP-06', N'Pants deportivo',                    N'Pants de tela técnica con bolsas con cierre.',               249.00, N'S,M,L,XL', N'Azul marino', 1, NULL),
    ('DEP-07', N'Chumpa cortavientos',                N'Chumpa cortavientos plegable.',                              379.00, N'M,L,XL',   N'Rojo', 1, NULL),

    ('ACC-01', N'Gorra bordada Quetzal',              N'Gorra de gabardina con un quetzal bordado.',                  99.00, NULL, N'Negro,Blanco,Azul marino', 1, NULL),
    ('ACC-02', N'Cincho de cuero',                    N'Cincho de cuero con hebilla metálica.',                      149.00, NULL, N'Negro,Café', 1, NULL),
    ('ACC-03', N'Bolso de mano de tela típica',       N'Bolso elaborado con tela típica de Totonicapán.',            349.00, NULL, N'Rojo,Azul', 1, NULL),
    ('ACC-04', N'Mochila urbana',                     N'Mochila con compartimiento para computadora.',               399.00, NULL, N'Negro,Gris', 1, NULL),
    ('ACC-05', N'Bufanda tejida',                     N'Bufanda de acrílico tejida.',                                129.00, NULL, N'Gris,Vino,Mostaza', 1, NULL),
    ('ACC-06', N'Sombrero de palma',                  N'Sombrero de palma trenzada.',                                179.00, NULL, N'Beige', 1, NULL),
    ('ACC-07', N'Billetera de cuero',                 N'Billetera de cuero con monedero.',                           199.00, NULL, N'Negro,Café', 1, NULL),
    ('ACC-08', N'Calcetines (paquete de 3)',          N'Paquete de tres pares de calcetines de algodón.',             79.00, NULL, N'Negro,Blanco', 1, NULL),
    ('ACC-09', N'Gorra edición limitada ShopCart',    N'Gorra de edición limitada: queda una sola unidad.',          149.00, NULL, N'Negro', 1, 'DEMO-CONCURRENCIA'),

    ('INF-01', N'Conjunto de pants infantil',         N'Conjunto de sudadero y pants de algodón.',                   179.00, N'4,6,8,10',      N'Azul', 1, NULL),
    ('INF-02', N'Vestido infantil de algodón',        N'Vestido de algodón con estampado.',                          159.00, N'2,4,6,8',       N'Rosado', 1, NULL),
    ('INF-03', N'Camiseta infantil estampada',        N'Camiseta de algodón con estampado de animales.',              79.00, N'2,4,6,8,10,12', N'Blanco,Celeste', 1, NULL),
    ('INF-04', N'Jeans infantiles',                   N'Jeans con cintura ajustable.',                               149.00, N'4,6,8,10,12',   N'Azul', 1, NULL),
    ('INF-05', N'Sudadero infantil con capucha',      N'Sudadero perchado con capucha.',                             169.00, N'6,8,10,12',     N'Rojo', 1, NULL),
    ('INF-06', N'Pijama de algodón infantil',         N'Pijama de dos piezas de algodón.',                           129.00, N'2,4,6',         N'Celeste', 1, NULL),
    ('INF-07', N'Chumpa infantil',                    N'Chumpa ligera con capucha desmontable.',                     199.00, N'4,6,8,10',      N'Mostaza', 1, NULL);

INSERT INTO dbo.Categoria (Nombre, Descripcion)
SELECT c.Nombre, c.Descripcion
FROM   @Categoria AS c
WHERE  NOT EXISTS (SELECT 1 FROM dbo.Categoria WHERE Nombre = c.Nombre);

INSERT INTO dbo.Atributo (Nombre, Orden)
SELECT a.Nombre, a.Orden
FROM   (VALUES (N'Talla', 1), (N'Color', 2)) AS a (Nombre, Orden)
WHERE  NOT EXISTS (SELECT 1 FROM dbo.Atributo WHERE Nombre = a.Nombre);

INSERT INTO dbo.ValorAtributo (IDAtributo, Valor, Orden)
SELECT a.IDAtributo, v.Valor, v.Orden
FROM   (SELECT N'Talla' AS Atributo, Valor, Orden FROM @Talla
        UNION ALL
        SELECT N'Color', Valor, Orden FROM @Color) AS v
JOIN   dbo.Atributo AS a ON a.Nombre = v.Atributo
WHERE  NOT EXISTS (SELECT 1 FROM dbo.ValorAtributo AS x WHERE x.IDAtributo = a.IDAtributo AND x.Valor = v.Valor);

INSERT INTO dbo.Producto (IDCategoria, Nombre, Descripcion, Activo)
SELECT cat.IDCategoria, p.Nombre, p.Descripcion, p.Activo
FROM   @Producto AS p
JOIN   @Categoria AS c ON c.Prefijo = LEFT(p.Codigo, 3)
JOIN   dbo.Categoria AS cat ON cat.Nombre = c.Nombre
WHERE  NOT EXISTS (SELECT 1 FROM dbo.Producto AS x WHERE x.IDCategoria = cat.IDCategoria AND x.Nombre = p.Nombre);

-- N-19: la imagen principal de cada producto es el SVG de su categoría, servido por el contenedor web.
INSERT INTO dbo.ImagenProducto (IDProducto, Url, TextoAlternativo, Orden, EsPrincipal)
SELECT pr.IDProducto, N'/static/productos/' + c.Imagen, p.Nombre, 1, 1
FROM   @Producto AS p
JOIN   @Categoria AS c ON c.Prefijo = LEFT(p.Codigo, 3)
JOIN   dbo.Categoria AS cat ON cat.Nombre = c.Nombre
JOIN   dbo.Producto AS pr ON pr.IDCategoria = cat.IDCategoria AND pr.Nombre = p.Nombre
WHERE  NOT EXISTS (SELECT 1 FROM dbo.ImagenProducto AS x WHERE x.IDProducto = pr.IDProducto);

-- Plan de variantes: una por combinación de talla y color de cada producto, numerada por SKU para
-- repartir existencias e historial de precios de forma determinista.
DECLARE @Variante TABLE (
    SKU                  VARCHAR(40)   NOT NULL PRIMARY KEY,
    IDProducto           INT           NOT NULL,
    IDValorTalla         INT           NULL,
    IDAtributoTalla      INT           NULL,
    IDValorColor         INT           NOT NULL,
    IDAtributoColor      INT           NOT NULL,
    FirmaAtributos       VARCHAR(200)  NOT NULL,
    DescripcionAtributos NVARCHAR(200) NOT NULL,
    Precio               DECIMAL(12,2) NOT NULL,
    Numero               INT           NULL,
    Existencia           INT           NULL
);

INSERT INTO @Variante (SKU, IDProducto, IDValorTalla, IDAtributoTalla, IDValorColor, IDAtributoColor,
                       FirmaAtributos, DescripcionAtributos, Precio)
SELECT  COALESCE(p.SKUFijo, p.Codigo + COALESCE('-' + CONVERT(VARCHAR(10), t.Valor), '') + '-' + col.Codigo),
        pr.IDProducto, vt.IDValorAtributo, vt.IDAtributo, vc.IDValorAtributo, vc.IDAtributo,
        -- Firma: IDs de ValorAtributo ordenados por IDAtributo (§3.3).
        CASE WHEN vt.IDValorAtributo IS NULL THEN CONVERT(VARCHAR(10), vc.IDValorAtributo)
             WHEN vt.IDAtributo < vc.IDAtributo
                 THEN CONVERT(VARCHAR(10), vt.IDValorAtributo) + '|' + CONVERT(VARCHAR(10), vc.IDValorAtributo)
             ELSE CONVERT(VARCHAR(10), vc.IDValorAtributo) + '|' + CONVERT(VARCHAR(10), vt.IDValorAtributo) END,
        COALESCE(t.Valor + N' / ', N'') + col.Valor,
        p.Precio
FROM    @Producto AS p
JOIN    @Categoria AS c ON c.Prefijo = LEFT(p.Codigo, 3)
JOIN    dbo.Categoria AS cat ON cat.Nombre = c.Nombre
JOIN    dbo.Producto AS pr ON pr.IDCategoria = cat.IDCategoria AND pr.Nombre = p.Nombre
CROSS APPLY STRING_SPLIT(p.Colores, N',') AS sc
JOIN    @Color AS col ON col.Valor = sc.value
JOIN    dbo.ValorAtributo AS vc ON vc.Valor = col.Valor
JOIN    dbo.Atributo AS ac ON ac.IDAtributo = vc.IDAtributo AND ac.Nombre = N'Color'
OUTER APPLY (SELECT st.value AS Valor FROM STRING_SPLIT(p.Tallas, N',') AS st) AS t
OUTER APPLY (
    SELECT va.IDValorAtributo, va.IDAtributo
    FROM   dbo.ValorAtributo AS va
    JOIN   dbo.Atributo AS at ON at.IDAtributo = va.IDAtributo AND at.Nombre = N'Talla'
    WHERE  va.Valor = t.Valor
) AS vt;

UPDATE v
SET    Numero = n.Numero
FROM   @Variante AS v
JOIN   (SELECT SKU, ROW_NUMBER() OVER (ORDER BY SKU) AS Numero FROM @Variante) AS n ON n.SKU = v.SKU;

-- Existencias: la mayoría entre 10 y 50, algunas entre 2 y 5, algunas agotadas y DEMO-CONCURRENCIA
-- con 1 unidad; así es la única variante con exactamente una unidad.
UPDATE @Variante
SET    Existencia = CASE
                        WHEN SKU = 'DEMO-CONCURRENCIA' THEN 1
                        WHEN Numero % 17 = 0           THEN 0
                        WHEN Numero % 11 = 0           THEN 2 + Numero % 4
                        ELSE 10 + (Numero * 7) % 41
                    END;

INSERT INTO dbo.Variante (IDProducto, SKU, FirmaAtributos, DescripcionAtributos)
SELECT v.IDProducto, v.SKU, v.FirmaAtributos, v.DescripcionAtributos
FROM   @Variante AS v
WHERE  NOT EXISTS (SELECT 1 FROM dbo.Variante WHERE SKU = v.SKU);

INSERT INTO dbo.VarianteValorAtributo (IDVariante, IDAtributo, IDValorAtributo)
SELECT dv.IDVariante, x.IDAtributo, x.IDValorAtributo
FROM   @Variante AS v
JOIN   dbo.Variante AS dv ON dv.SKU = v.SKU
CROSS APPLY (VALUES (v.IDAtributoTalla, v.IDValorTalla), (v.IDAtributoColor, v.IDValorColor)) AS x (IDAtributo, IDValorAtributo)
WHERE  x.IDValorAtributo IS NOT NULL
  AND  NOT EXISTS (SELECT 1 FROM dbo.VarianteValorAtributo AS e
                   WHERE e.IDVariante = dv.IDVariante AND e.IDAtributo = x.IDAtributo);

-- N-02: ~10 variantes con un precio anterior ya cerrado (unas bajaron y otras subieron), para
-- mostrar el historial. Se insertan antes que el vigente para que la bitácora vea el orden real.
DECLARE @ConHistorial TABLE (SKU VARCHAR(40) NOT NULL PRIMARY KEY, PrecioAnterior DECIMAL(12,2) NOT NULL);
INSERT INTO @ConHistorial (SKU, PrecioAnterior)
SELECT SKU,
       CASE WHEN Numero % 2 = 0 THEN CONVERT(DECIMAL(12,2), ROUND(Precio * 1.20, 0))
            ELSE CONVERT(DECIMAL(12,2), ROUND(Precio * 0.90, 0)) END
FROM   @Variante
WHERE  Numero % 24 = 3 AND SKU <> 'DEMO-CONCURRENCIA';

INSERT INTO dbo.PrecioVariante (IDVariante, Precio, VigenteDesde, VigenteHasta, IDUsuario)
SELECT dv.IDVariante, h.PrecioAnterior, @FechaInicial, @FechaCambioPrecio, @IDAdmin
FROM   @ConHistorial AS h
JOIN   dbo.Variante AS dv ON dv.SKU = h.SKU
WHERE  NOT EXISTS (SELECT 1 FROM dbo.PrecioVariante WHERE IDVariante = dv.IDVariante);

INSERT INTO dbo.PrecioVariante (IDVariante, Precio, VigenteDesde, IDUsuario)
SELECT dv.IDVariante, v.Precio,
       CASE WHEN h.SKU IS NULL THEN @FechaInicial ELSE @FechaCambioPrecio END,
       @IDAdmin
FROM   @Variante AS v
JOIN   dbo.Variante AS dv ON dv.SKU = v.SKU
LEFT JOIN @ConHistorial AS h ON h.SKU = v.SKU
WHERE  NOT EXISTS (SELECT 1 FROM dbo.PrecioVariante WHERE IDVariante = dv.IDVariante AND VigenteHasta IS NULL);

-- N-07: una entrada inicial por variante con existencia, a través del único SP que escribe el kardex.
DECLARE @Entrada TABLE (IDVariante INT NOT NULL PRIMARY KEY, Cantidad INT NOT NULL);
INSERT INTO @Entrada (IDVariante, Cantidad)
SELECT dv.IDVariante, v.Existencia
FROM   @Variante AS v
JOIN   dbo.Variante AS dv ON dv.SKU = v.SKU
WHERE  v.Existencia > 0
  AND  NOT EXISTS (SELECT 1 FROM dbo.MovimientoKardex WHERE IDVariante = dv.IDVariante);

DECLARE @IDVariante INT, @Cantidad INT;
SELECT TOP (1) @IDVariante = IDVariante, @Cantidad = Cantidad FROM @Entrada ORDER BY IDVariante;
WHILE @IDVariante IS NOT NULL
BEGIN
    EXEC dbo.SP_Inventario_RegistrarMovimiento
         @IDVariante = @IDVariante, @CodigoTipo = 'EntradaCompra', @Cantidad = @Cantidad,
         @Motivo = N'Inventario inicial', @Referencia = N'S004__catalogo_demo',
         @IDPedido = NULL, @IDDevolucion = NULL;

    DELETE FROM @Entrada WHERE IDVariante = @IDVariante;
    SET @IDVariante = NULL;
    SELECT TOP (1) @IDVariante = IDVariante, @Cantidad = Cantidad FROM @Entrada ORDER BY IDVariante;
END;

EXEC dbo.SP_Sistema_EstablecerContexto;
