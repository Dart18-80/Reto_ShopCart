-- Escenario de prueba: tarda 2 s, para que dos migradores se encuentren a la vez. Si se aplicara dos veces, el CREATE fallaría.
WAITFOR DELAY '00:00:02';
CREATE TABLE dbo.Lento (IDLento INT NOT NULL CONSTRAINT PK_Lento PRIMARY KEY);
