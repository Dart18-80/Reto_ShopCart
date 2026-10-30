-- Escenario de prueba: el mismo V002 corregido. Si el intento fallido hubiera dejado dbo.Dos, este CREATE fallaría.
CREATE TABLE dbo.Dos (IDDos INT NOT NULL CONSTRAINT PK_Dos PRIMARY KEY);
GO
CREATE TABLE dbo.Tres (IDTres INT NOT NULL CONSTRAINT PK_Tres PRIMARY KEY);
