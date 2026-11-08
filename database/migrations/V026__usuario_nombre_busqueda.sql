-- V026 (M8-H01, A-10): el nombre del usuario para buscarlo sin mayúsculas ni tildes, igual que Producto.
-- La gestión de pedidos filtra por el cliente escrito como texto ("inigo nunez" encuentra a "Íñigo Núñez").
-- El correo ya se compara sin mayúsculas (la colación de la base es CI) y no lleva tildes.
ALTER TABLE dbo.Usuario ADD NombreBusqueda AS (Nombre COLLATE Latin1_General_CI_AI) PERSISTED;
GO
