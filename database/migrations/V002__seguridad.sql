-- V002: roles, usuarios y refresh tokens (02-modelo-datos.md §3.1).

CREATE TABLE dbo.Rol (
    IDRol         INT IDENTITY(1,1) NOT NULL,
    Codigo        VARCHAR(20)       NOT NULL,
    Nombre        NVARCHAR(50)      NOT NULL,
    FechaCreacion DATETIME2(3)      NOT NULL CONSTRAINT DF_Rol_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Rol PRIMARY KEY (IDRol),
    CONSTRAINT UQ_Rol_Codigo UNIQUE (Codigo),
    CONSTRAINT CK_Rol_Codigo CHECK (Codigo IN ('Cliente', 'Operador', 'Administrador'))
);

CREATE TABLE dbo.Usuario (
    IDUsuario          INT IDENTITY(1,1) NOT NULL,
    Correo             NVARCHAR(254)     NOT NULL,
    -- N-15: el correo es único sin distinguir mayúsculas.
    CorreoNormalizado  AS LOWER(Correo) PERSISTED,
    HashContrasena     VARCHAR(255)      NOT NULL,
    Nombre             NVARCHAR(100)     NOT NULL,
    Telefono           VARCHAR(8)        NULL,
    IDRol              INT               NOT NULL,
    Activo             BIT               NOT NULL CONSTRAINT DF_Usuario_Activo DEFAULT 1,
    FechaDesactivacion DATETIME2(3)      NULL,
    FechaCreacion      DATETIME2(3)      NOT NULL CONSTRAINT DF_Usuario_FechaCreacion DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(3)      NOT NULL CONSTRAINT DF_Usuario_FechaActualizacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Usuario PRIMARY KEY (IDUsuario),
    CONSTRAINT UQ_Usuario_CorreoNormalizado UNIQUE (CorreoNormalizado),
    CONSTRAINT FK_Usuario_Rol FOREIGN KEY (IDRol) REFERENCES dbo.Rol (IDRol),
    CONSTRAINT CK_Usuario_Telefono CHECK (Telefono LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'),
    CONSTRAINT CK_Usuario_Desactivacion CHECK (
        (Activo = 1 AND FechaDesactivacion IS NULL) OR (Activo = 0 AND FechaDesactivacion IS NOT NULL))
);

CREATE TABLE dbo.RefreshToken (
    IDRefreshToken   BIGINT IDENTITY(1,1) NOT NULL,
    IDUsuario        INT                  NOT NULL,
    -- Agrupa la cadena de rotaciones: un reúso revoca la familia completa (A-07).
    IDFamilia        UNIQUEIDENTIFIER     NOT NULL,
    HashToken        BINARY(32)           NOT NULL,
    FechaExpiracion  DATETIME2(3)         NOT NULL,
    FechaUso         DATETIME2(3)         NULL,
    FechaRevocacion  DATETIME2(3)         NULL,
    MotivoRevocacion VARCHAR(30)          NULL,
    IP               VARCHAR(45)          NULL,
    UserAgent        NVARCHAR(300)        NULL,
    FechaCreacion    DATETIME2(3)         NOT NULL CONSTRAINT DF_RefreshToken_FechaCreacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_RefreshToken PRIMARY KEY (IDRefreshToken),
    CONSTRAINT UQ_RefreshToken_HashToken UNIQUE (HashToken),
    CONSTRAINT FK_RefreshToken_Usuario FOREIGN KEY (IDUsuario) REFERENCES dbo.Usuario (IDUsuario),
    CONSTRAINT CK_RefreshToken_MotivoRevocacion
        CHECK (MotivoRevocacion IN ('Logout', 'Reuso', 'Desactivacion', 'CambioContrasena'))
);

CREATE INDEX IX_RefreshToken_IDFamilia ON dbo.RefreshToken (IDFamilia);
CREATE INDEX IX_RefreshToken_IDUsuario ON dbo.RefreshToken (IDUsuario);
