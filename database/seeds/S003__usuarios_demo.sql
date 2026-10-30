-- S003: cuentas demo. Las contraseñas están documentadas en el README (lo pide el enunciado); aquí solo
-- van sus hashes argon2id con los parámetros de OWASP (19 MiB, 2 iteraciones, 1 hilo).
-- cliente2 existe para demostrar el aislamiento entre clientes (RF-01).

INSERT INTO dbo.Usuario (Correo, HashContrasena, Nombre, IDRol)
SELECT u.Correo, u.HashContrasena, u.Nombre, r.IDRol
FROM (VALUES
    (N'admin@shopcart.gt',    '$argon2id$v=19$m=19456,t=2,p=1$AGCpRDj/3XYL0VqP6lOTjQ$z/vRHjd2LgTyBIp8yCFbkvbF+mW1Z7Gbzgz1qRgEFP4',
     N'Administrador Demo',   'Administrador'),
    (N'operador@shopcart.gt', '$argon2id$v=19$m=19456,t=2,p=1$1qXlqQ5m96wYv0QMgMzLJg$rLesBN6QwHVRmZFzPHXRPb0KHzuVfnwt8cgO1xBVQcI',
     N'Operador Demo',        'Operador'),
    (N'cliente@shopcart.gt',  '$argon2id$v=19$m=19456,t=2,p=1$hSb+QXVQ2OJCVBKacnfl+A$pST8tHhxtYREdjCi3n+CD9l2CXXD+Mkn/rGZ3/j55/k',
     N'Cliente Demo',         'Cliente'),
    (N'cliente2@shopcart.gt', '$argon2id$v=19$m=19456,t=2,p=1$tfcrdalHRT5+7dJ3i+SLIw$tEk37bGbLFz+2KFy/eTeSlwPivtPHNEqVx1fdQFEQnE',
     N'Segundo Cliente Demo', 'Cliente')
) AS u (Correo, HashContrasena, Nombre, Rol)
JOIN dbo.Rol AS r ON r.Codigo = u.Rol
WHERE NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE CorreoNormalizado = LOWER(u.Correo));
