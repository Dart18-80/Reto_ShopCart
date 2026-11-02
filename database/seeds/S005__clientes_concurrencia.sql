-- S005 (E5-H05, RNF-3): los 20 clientes de la prueba de concurrencia (apps/api/test/concurrencia). Su
-- contraseña está documentada en el README; aquí solo van sus hashes argon2id con los parámetros de OWASP
-- (19 MiB, 2 iteraciones, 1 hilo). La prueba les crea la dirección y limpia su carrito en cada corrida.

INSERT INTO dbo.Usuario (Correo, HashContrasena, Nombre, IDRol)
SELECT u.Correo, u.HashContrasena, u.Nombre, r.IDRol
FROM (VALUES
    (N'concurrencia01@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$WRp1S3fxSSOt7duIDT9c2Q$53I1gxJ6cVVCrjZzw9VFHOcekK0XTGZM5bOO6bpC8KU', N'Cliente Concurrencia 01'),
    (N'concurrencia02@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$2f2Gv3WenR50N4dium2irA$Ez1lMbgzeLgnOe7ocxBxNSUPkDABrooLF0GeBscZaa0', N'Cliente Concurrencia 02'),
    (N'concurrencia03@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$ae2rpcufDh0U93jCP0HsSQ$EuH1FH59jvWzfCL7YhDMpSREfJrPmAucvGwMJ3GYEwY', N'Cliente Concurrencia 03'),
    (N'concurrencia04@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$O+BtxS+4swBPSLbveMM1mg$NM+AG/0MnmcbFm8B2ng9Q/LEHqVYbp3/8hd93foZH48', N'Cliente Concurrencia 04'),
    (N'concurrencia05@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$nS38tu0aYFPo+pHZ0NN1jg$hNptOIrTruTN6aBUKff3/5egUBV5qSY2Y9lt4U6Ou78', N'Cliente Concurrencia 05'),
    (N'concurrencia06@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$Wwsu1rqhhDsnKIRCAFAjDA$YhEnpu9o288UkDkLgyf9J8vIzTiECumoQTaYRH/guDY', N'Cliente Concurrencia 06'),
    (N'concurrencia07@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$PyxgWWiYVfBOK7ROO8KL2Q$inx5eTk0CR47CekzC12lIk/TWeFDg80/ADoVKxDarGw', N'Cliente Concurrencia 07'),
    (N'concurrencia08@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$DKG5Po6TETEZYAjWW6qkIg$Gg3egD59r3N+zoteciqIstoZFgf7sOZJ+lQN4jd4kwY', N'Cliente Concurrencia 08'),
    (N'concurrencia09@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$jUrvDWL8kYBxoldhjkiWYw$3/cmB6kt437Xv3cpEiXolTlKCvxlnTvzMN4vNdiIl/U', N'Cliente Concurrencia 09'),
    (N'concurrencia10@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$1aQZ+R4BsDCDOHepTP2tvg$9tmiLNzY6rfo2NMG2obu06Ou0P+WPsi7U3cEXk+D1Ic', N'Cliente Concurrencia 10'),
    (N'concurrencia11@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$UeNIVhzpbpSuHdQXGIjKjQ$K66Ti/7jlbnfe4yw3FqkfBRckofttY8JU1EJ4vpX+YY', N'Cliente Concurrencia 11'),
    (N'concurrencia12@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$dTtokpiUEXHIchI2NtZheg$oKLmyuOe79TQMQ8eyRDG4Adb2wwdBhbLQ3Ehti25b9g', N'Cliente Concurrencia 12'),
    (N'concurrencia13@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$BQcWWdHjn0d6t6V3XQEe5g$xIqqOYjjdyfGVWj4qhzlH0gOzMTqa2nVJjZou3ZzDeQ', N'Cliente Concurrencia 13'),
    (N'concurrencia14@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$CngCz8GXK3IusSt6Rvacow$eFdkV1/utzmwNFcYaY1BAqhYcaS0056d3e7xVsbeL6k', N'Cliente Concurrencia 14'),
    (N'concurrencia15@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$C9iejEyDrdUmpF+hRVmXjg$rfACdgrNW8MwCdtJ1IfIXE3ADBEZUlw49tQK72ap1Qc', N'Cliente Concurrencia 15'),
    (N'concurrencia16@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$kc8Kkd7fr9eHUsBD6aT5Jw$0qPjc43FwijcKIDfjdDvdx38xQn2VOnKdkhYETWDwDI', N'Cliente Concurrencia 16'),
    (N'concurrencia17@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$Pz9SNS9BVMynKrTI73iwfg$06xPS6l97L5gRqKh23WIM/cjoPT1KcjPfVFUeT7lWs8', N'Cliente Concurrencia 17'),
    (N'concurrencia18@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$dL50yV/Q9O33SYskabj1YA$ACUhdy2z16KZwtm4nubRODfK+6nwaNMEq/KjPCP6EYA', N'Cliente Concurrencia 18'),
    (N'concurrencia19@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$XNFAshMDTmKhZHgBEqVtkw$4+uUgw5QIEQ8V7+RL3LE7c4TOv/Ls3ARiMF8vXwos7k', N'Cliente Concurrencia 19'),
    (N'concurrencia20@shopcart.gt', '$argon2id$v=19$m=19456,p=1,t=2$XevoSesI0qgASHRDq8WGYQ$DXV0X38p5HSsZGIDS5ksnjOWSjIuTbMq2OY40OeoRzw', N'Cliente Concurrencia 20')
) AS u (Correo, HashContrasena, Nombre)
JOIN dbo.Rol AS r ON r.Codigo = 'Cliente'
WHERE NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE CorreoNormalizado = LOWER(u.Correo));
