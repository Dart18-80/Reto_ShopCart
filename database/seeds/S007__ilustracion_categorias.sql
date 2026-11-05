-- S007 (M2-H01, FE-15): la ilustración de prenda de las 8 categorías de la semilla (S004). Idempotente: solo
-- cambia las que todavía no la tienen. La semilla actúa como el administrador demo: la bitácora lo registra.
DECLARE @IDAdmin INT = (SELECT IDUsuario FROM dbo.Usuario WHERE CorreoNormalizado = N'admin@shopcart.gt');

EXEC dbo.SP_Sistema_EstablecerContexto @IDUsuarioActor = @IDAdmin, @RolActor = 'Administrador';

UPDATE c
SET    c.Ilustracion        = i.Ilustracion,
       c.FechaActualizacion = SYSUTCDATETIME()
FROM   dbo.Categoria AS c
JOIN   (VALUES (N'Camisas y blusas',     'Camisa'),
               (N'Pantalones',           'Pantalon'),
               (N'Vestidos y faldas',    'Vestido'),
               (N'Chaquetas y suéteres', 'Chaqueta'),
               (N'Calzado',              'Tenis'),
               (N'Ropa deportiva',       'Camisa'),
               (N'Accesorios',           'Gorra'),
               (N'Infantil',             'Camisa')) AS i (Nombre, Ilustracion)
       ON i.Nombre = c.Nombre
WHERE  c.Ilustracion <> i.Ilustracion;

EXEC dbo.SP_Sistema_EstablecerContexto;
