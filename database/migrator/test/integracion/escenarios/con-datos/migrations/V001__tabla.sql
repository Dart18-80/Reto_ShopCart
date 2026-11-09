-- Escenario de prueba (A-27): una tabla con un índice, creada vacía; sus estadísticas nacen sin filas.
CREATE TABLE dbo.Venta (
    IDVenta INT NOT NULL CONSTRAINT PK_Venta PRIMARY KEY,
    Dia     DATE NOT NULL
);
CREATE INDEX IX_Venta_Dia ON dbo.Venta (Dia);
