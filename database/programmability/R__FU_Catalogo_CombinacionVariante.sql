-- N-14, A-22: lee la combinación de una variante (arreglo JSON de IDs de ValorAtributo) y la resume en una
-- fila: la firma canónica (IDs ordenados por IDAtributo), la descripción legible (por el orden de los
-- atributos), el conjunto de atributos y los contadores con los que el SP valida repetidos, inexistentes y
-- un solo valor por atributo. El SP verifica ISJSON antes de usarla. Sin valores: firma vacía, "Única".
CREATE OR ALTER FUNCTION dbo.FU_Catalogo_CombinacionVariante (@Valores NVARCHAR(MAX))
RETURNS TABLE
AS
RETURN
    WITH Lista AS (
        SELECT j.IDValorAtributo, va.IDAtributo, va.Valor, a.Orden AS OrdenAtributo
        FROM   OPENJSON(@Valores) WITH (IDValorAtributo INT '$') AS j
        LEFT JOIN dbo.ValorAtributo AS va ON va.IDValorAtributo = j.IDValorAtributo
        LEFT JOIN dbo.Atributo      AS a  ON a.IDAtributo = va.IDAtributo
    )
    SELECT  c.Valores, c.ValoresDistintos, c.Atributos, c.Inexistentes, c.Firma, c.ConjuntoAtributos,
            -- Otro SELECT: SQL Server no admite dos STRING_AGG con órdenes distintos en el mismo nivel.
            COALESCE((SELECT STRING_AGG(CONVERT(NVARCHAR(MAX), l.Valor), N' / ')
                             WITHIN GROUP (ORDER BY l.OrdenAtributo, l.IDAtributo)
                      FROM Lista AS l), N'Única') AS Descripcion
    FROM (
        SELECT  COUNT(*)                                             AS Valores,
                COUNT(DISTINCT IDValorAtributo)                      AS ValoresDistintos,
                COUNT(DISTINCT IDAtributo)                           AS Atributos,
                SUM(CASE WHEN IDAtributo IS NULL THEN 1 ELSE 0 END)  AS Inexistentes,
                COALESCE(STRING_AGG(CONVERT(VARCHAR(MAX), IDValorAtributo), '|')
                             WITHIN GROUP (ORDER BY IDAtributo), '') AS Firma,
                COALESCE(STRING_AGG(CONVERT(VARCHAR(MAX), IDAtributo), '|')
                             WITHIN GROUP (ORDER BY IDAtributo), '') AS ConjuntoAtributos
        FROM    Lista
    ) AS c;
GO
