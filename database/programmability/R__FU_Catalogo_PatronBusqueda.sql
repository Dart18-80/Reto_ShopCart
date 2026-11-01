-- A-10: convierte el texto del usuario en patrones de LIKE que lo buscan literal. Escapa \ (el carácter de
-- escape), %, _ y [ para usarlos con ESCAPE N'\': buscar "50%" no trae todo. Contiene es '%texto%' y
-- EmpiezaCon es 'texto%' (la relevancia de la búsqueda). Con texto NULL, ambos son NULL.
CREATE OR ALTER FUNCTION dbo.FU_Catalogo_PatronBusqueda (@Texto NVARCHAR(150))
RETURNS TABLE
AS
RETURN
    SELECT N'%' + e.Escapado + N'%' AS Contiene,
           e.Escapado + N'%'        AS EmpiezaCon
    FROM  (SELECT REPLACE(REPLACE(REPLACE(REPLACE(@Texto, N'\', N'\\'), N'%', N'\%'), N'_', N'\_'), N'[', N'\[')
                  AS Escapado) AS e;
GO
