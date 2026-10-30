-- Escenario de prueba: el primer lote se aplica y el segundo falla; nada de este script debe quedar.
CREATE TABLE dbo.Dos (IDDos INT NOT NULL CONSTRAINT PK_Dos PRIMARY KEY);
GO
THROW 50003, N'Falla a propósito en el segundo lote.', 1;
