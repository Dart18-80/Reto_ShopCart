-- V010: versión de sesión por usuario (N-15, A-07). Los SPs que desactivan, cambian el rol o cambian la
-- contraseña la incrementan; el access token la lleva y autenticar rechaza las versiones anteriores.

ALTER TABLE dbo.Usuario
    ADD VersionSesion INT NOT NULL
        CONSTRAINT DF_Usuario_VersionSesion DEFAULT (0)
        CONSTRAINT CK_Usuario_VersionSesion CHECK (VersionSesion >= 0);
GO
