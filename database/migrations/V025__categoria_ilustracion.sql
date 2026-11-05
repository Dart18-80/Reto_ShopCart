-- V025 (M2-H01, FE-15): la ilustración de prenda con que la tienda dibuja los productos de cada categoría.
-- Es un atributo de presentación, no una regla de negocio; el CHECK es la misma lista que valida Zod.
-- Las categorías que ya existen quedan con el valor por defecto; S007 asigna las de la semilla.
ALTER TABLE dbo.Categoria ADD
    Ilustracion VARCHAR(20) NOT NULL CONSTRAINT DF_Categoria_Ilustracion DEFAULT 'Camisa',
    CONSTRAINT CK_Categoria_Ilustracion
        CHECK (Ilustracion IN ('Camisa', 'Pantalon', 'Vestido', 'Chaqueta', 'Tenis', 'Gorra'));
GO
