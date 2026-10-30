-- Se ejecuta dentro de la transacción del script: o queda aplicado y registrado, o nada.
-- Parámetros: @Script, @Tipo, @Checksum.
INSERT INTO dbo.HistorialMigracion (Script, Tipo, Checksum)
VALUES (@Script, @Tipo, @Checksum);
