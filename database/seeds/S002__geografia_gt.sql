-- S002: N-17, los 22 departamentos y 340 municipios de Guatemala.

INSERT INTO dbo.Departamento (Nombre)
SELECT d.Nombre
FROM (VALUES
    (N'Alta Verapaz'), (N'Baja Verapaz'), (N'Chimaltenango'), (N'Chiquimula'), (N'El Progreso'),
    (N'Escuintla'), (N'Guatemala'), (N'Huehuetenango'), (N'Izabal'), (N'Jalapa'), (N'Jutiapa'),
    (N'Petén'), (N'Quetzaltenango'), (N'Quiché'), (N'Retalhuleu'), (N'Sacatepéquez'), (N'San Marcos'),
    (N'Santa Rosa'), (N'Sololá'), (N'Suchitepéquez'), (N'Totonicapán'), (N'Zacapa')
) AS d (Nombre)
WHERE NOT EXISTS (SELECT 1 FROM dbo.Departamento WHERE Nombre = d.Nombre);

INSERT INTO dbo.Municipio (IDDepartamento, Nombre)
SELECT d.IDDepartamento, m.Municipio
FROM (VALUES
    (N'Alta Verapaz', N'Cobán'), (N'Alta Verapaz', N'Santa Cruz Verapaz'), (N'Alta Verapaz', N'San Cristóbal Verapaz'),
    (N'Alta Verapaz', N'Tactic'), (N'Alta Verapaz', N'Tamahú'), (N'Alta Verapaz', N'Tucurú'),
    (N'Alta Verapaz', N'Panzós'), (N'Alta Verapaz', N'Senahú'), (N'Alta Verapaz', N'San Pedro Carchá'),
    (N'Alta Verapaz', N'San Juan Chamelco'), (N'Alta Verapaz', N'Lanquín'), (N'Alta Verapaz', N'Cahabón'),
    (N'Alta Verapaz', N'Chisec'), (N'Alta Verapaz', N'Chahal'), (N'Alta Verapaz', N'Fray Bartolomé de las Casas'),
    (N'Alta Verapaz', N'Santa Catalina La Tinta'), (N'Alta Verapaz', N'Raxruhá'),

    (N'Baja Verapaz', N'Salamá'), (N'Baja Verapaz', N'San Miguel Chicaj'), (N'Baja Verapaz', N'Rabinal'),
    (N'Baja Verapaz', N'Cubulco'), (N'Baja Verapaz', N'Granados'), (N'Baja Verapaz', N'Santa Cruz El Chol'),
    (N'Baja Verapaz', N'San Jerónimo'), (N'Baja Verapaz', N'Purulhá'),

    (N'Chimaltenango', N'Chimaltenango'), (N'Chimaltenango', N'San José Poaquil'),
    (N'Chimaltenango', N'San Martín Jilotepeque'), (N'Chimaltenango', N'San Juan Comalapa'),
    (N'Chimaltenango', N'Santa Apolonia'), (N'Chimaltenango', N'Tecpán Guatemala'), (N'Chimaltenango', N'Patzún'),
    (N'Chimaltenango', N'San Miguel Pochuta'), (N'Chimaltenango', N'Patzicía'), (N'Chimaltenango', N'Santa Cruz Balanyá'),
    (N'Chimaltenango', N'Acatenango'), (N'Chimaltenango', N'San Pedro Yepocapa'), (N'Chimaltenango', N'San Andrés Itzapa'),
    (N'Chimaltenango', N'Parramos'), (N'Chimaltenango', N'Zaragoza'), (N'Chimaltenango', N'El Tejar'),

    (N'Chiquimula', N'Chiquimula'), (N'Chiquimula', N'San José La Arada'), (N'Chiquimula', N'San Juan Ermita'),
    (N'Chiquimula', N'Jocotán'), (N'Chiquimula', N'Camotán'), (N'Chiquimula', N'Olopa'), (N'Chiquimula', N'Esquipulas'),
    (N'Chiquimula', N'Concepción Las Minas'), (N'Chiquimula', N'Quezaltepeque'), (N'Chiquimula', N'San Jacinto'),
    (N'Chiquimula', N'Ipala'),

    (N'El Progreso', N'Guastatoya'), (N'El Progreso', N'Morazán'), (N'El Progreso', N'San Agustín Acasaguastlán'),
    (N'El Progreso', N'San Cristóbal Acasaguastlán'), (N'El Progreso', N'El Jícaro'), (N'El Progreso', N'Sansare'),
    (N'El Progreso', N'Sanarate'), (N'El Progreso', N'San Antonio La Paz'),

    (N'Escuintla', N'Escuintla'), (N'Escuintla', N'Santa Lucía Cotzumalguapa'), (N'Escuintla', N'La Democracia'),
    (N'Escuintla', N'Siquinalá'), (N'Escuintla', N'Masagua'), (N'Escuintla', N'Tiquisate'), (N'Escuintla', N'La Gomera'),
    (N'Escuintla', N'Guanagazapa'), (N'Escuintla', N'San José'), (N'Escuintla', N'Iztapa'), (N'Escuintla', N'Palín'),
    (N'Escuintla', N'San Vicente Pacaya'), (N'Escuintla', N'Nueva Concepción'), (N'Escuintla', N'Sipacate'),

    (N'Guatemala', N'Guatemala'), (N'Guatemala', N'Santa Catarina Pinula'), (N'Guatemala', N'San José Pinula'),
    (N'Guatemala', N'San José del Golfo'), (N'Guatemala', N'Palencia'), (N'Guatemala', N'Chinautla'),
    (N'Guatemala', N'San Pedro Ayampuc'), (N'Guatemala', N'Mixco'), (N'Guatemala', N'San Pedro Sacatepéquez'),
    (N'Guatemala', N'San Juan Sacatepéquez'), (N'Guatemala', N'San Raymundo'), (N'Guatemala', N'Chuarrancho'),
    (N'Guatemala', N'Fraijanes'), (N'Guatemala', N'Amatitlán'), (N'Guatemala', N'Villa Nueva'),
    (N'Guatemala', N'Villa Canales'), (N'Guatemala', N'San Miguel Petapa'),

    (N'Huehuetenango', N'Huehuetenango'), (N'Huehuetenango', N'Chiantla'), (N'Huehuetenango', N'Malacatancito'),
    (N'Huehuetenango', N'Cuilco'), (N'Huehuetenango', N'Nentón'), (N'Huehuetenango', N'San Pedro Necta'),
    (N'Huehuetenango', N'Jacaltenango'), (N'Huehuetenango', N'San Pedro Soloma'),
    (N'Huehuetenango', N'San Ildefonso Ixtahuacán'), (N'Huehuetenango', N'Santa Bárbara'),
    (N'Huehuetenango', N'La Libertad'), (N'Huehuetenango', N'La Democracia'), (N'Huehuetenango', N'San Miguel Acatán'),
    (N'Huehuetenango', N'San Rafael La Independencia'), (N'Huehuetenango', N'Todos Santos Cuchumatán'),
    (N'Huehuetenango', N'San Juan Atitán'), (N'Huehuetenango', N'Santa Eulalia'), (N'Huehuetenango', N'San Mateo Ixtatán'),
    (N'Huehuetenango', N'Colotenango'), (N'Huehuetenango', N'San Sebastián Huehuetenango'),
    (N'Huehuetenango', N'Tectitán'), (N'Huehuetenango', N'Concepción Huista'), (N'Huehuetenango', N'San Juan Ixcoy'),
    (N'Huehuetenango', N'San Antonio Huista'), (N'Huehuetenango', N'San Sebastián Coatán'),
    (N'Huehuetenango', N'Santa Cruz Barillas'), (N'Huehuetenango', N'Aguacatán'), (N'Huehuetenango', N'San Rafael Petzal'),
    (N'Huehuetenango', N'San Gaspar Ixchil'), (N'Huehuetenango', N'Santiago Chimaltenango'),
    (N'Huehuetenango', N'Santa Ana Huista'), (N'Huehuetenango', N'Unión Cantinil'), (N'Huehuetenango', N'Petatán'),

    (N'Izabal', N'Puerto Barrios'), (N'Izabal', N'Livingston'), (N'Izabal', N'El Estor'), (N'Izabal', N'Morales'),
    (N'Izabal', N'Los Amates'),

    (N'Jalapa', N'Jalapa'), (N'Jalapa', N'San Pedro Pinula'), (N'Jalapa', N'San Luis Jilotepeque'),
    (N'Jalapa', N'San Manuel Chaparrón'), (N'Jalapa', N'San Carlos Alzatate'), (N'Jalapa', N'Monjas'),
    (N'Jalapa', N'Mataquescuintla'),

    (N'Jutiapa', N'Jutiapa'), (N'Jutiapa', N'El Progreso'), (N'Jutiapa', N'Santa Catarina Mita'),
    (N'Jutiapa', N'Agua Blanca'), (N'Jutiapa', N'Asunción Mita'), (N'Jutiapa', N'Yupiltepeque'),
    (N'Jutiapa', N'Atescatempa'), (N'Jutiapa', N'Jerez'), (N'Jutiapa', N'El Adelanto'), (N'Jutiapa', N'Zapotitlán'),
    (N'Jutiapa', N'Comapa'), (N'Jutiapa', N'Jalpatagua'), (N'Jutiapa', N'Conguaco'), (N'Jutiapa', N'Moyuta'),
    (N'Jutiapa', N'Pasaco'), (N'Jutiapa', N'San José Acatempa'), (N'Jutiapa', N'Quesada'),

    (N'Petén', N'Flores'), (N'Petén', N'San José'), (N'Petén', N'San Benito'), (N'Petén', N'San Andrés'),
    (N'Petén', N'La Libertad'), (N'Petén', N'San Francisco'), (N'Petén', N'Santa Ana'), (N'Petén', N'Dolores'),
    (N'Petén', N'San Luis'), (N'Petén', N'Sayaxché'), (N'Petén', N'Melchor de Mencos'), (N'Petén', N'Poptún'),
    (N'Petén', N'Las Cruces'), (N'Petén', N'El Chal'),

    (N'Quetzaltenango', N'Quetzaltenango'), (N'Quetzaltenango', N'Salcajá'), (N'Quetzaltenango', N'Olintepeque'),
    (N'Quetzaltenango', N'San Carlos Sija'), (N'Quetzaltenango', N'Sibilia'), (N'Quetzaltenango', N'Cabricán'),
    (N'Quetzaltenango', N'Cajolá'), (N'Quetzaltenango', N'San Miguel Sigüilá'),
    (N'Quetzaltenango', N'San Juan Ostuncalco'), (N'Quetzaltenango', N'San Mateo'),
    (N'Quetzaltenango', N'Concepción Chiquirichapa'), (N'Quetzaltenango', N'San Martín Sacatepéquez'),
    (N'Quetzaltenango', N'Almolonga'), (N'Quetzaltenango', N'Cantel'), (N'Quetzaltenango', N'Huitán'),
    (N'Quetzaltenango', N'Zunil'), (N'Quetzaltenango', N'Colomba Costa Cuca'),
    (N'Quetzaltenango', N'San Francisco La Unión'), (N'Quetzaltenango', N'El Palmar'),
    (N'Quetzaltenango', N'Coatepeque'), (N'Quetzaltenango', N'Génova'), (N'Quetzaltenango', N'Flores Costa Cuca'),
    (N'Quetzaltenango', N'La Esperanza'), (N'Quetzaltenango', N'Palestina de Los Altos'),

    (N'Quiché', N'Santa Cruz del Quiché'), (N'Quiché', N'Chiché'), (N'Quiché', N'Chinique'), (N'Quiché', N'Zacualpa'),
    (N'Quiché', N'Chajul'), (N'Quiché', N'Chichicastenango'), (N'Quiché', N'Patzité'),
    (N'Quiché', N'San Antonio Ilotenango'), (N'Quiché', N'San Pedro Jocopilas'), (N'Quiché', N'Cunén'),
    (N'Quiché', N'San Juan Cotzal'), (N'Quiché', N'Joyabaj'), (N'Quiché', N'Nebaj'),
    (N'Quiché', N'San Andrés Sajcabajá'), (N'Quiché', N'Uspantán'), (N'Quiché', N'Sacapulas'),
    (N'Quiché', N'San Bartolomé Jocotenango'), (N'Quiché', N'Canillá'), (N'Quiché', N'Chicamán'),
    (N'Quiché', N'Ixcán'), (N'Quiché', N'Pachalum'),

    (N'Retalhuleu', N'Retalhuleu'), (N'Retalhuleu', N'San Sebastián'), (N'Retalhuleu', N'Santa Cruz Muluá'),
    (N'Retalhuleu', N'San Martín Zapotitlán'), (N'Retalhuleu', N'San Felipe'), (N'Retalhuleu', N'San Andrés Villa Seca'),
    (N'Retalhuleu', N'Champerico'), (N'Retalhuleu', N'Nuevo San Carlos'), (N'Retalhuleu', N'El Asintal'),

    (N'Sacatepéquez', N'Antigua Guatemala'), (N'Sacatepéquez', N'Jocotenango'), (N'Sacatepéquez', N'Pastores'),
    (N'Sacatepéquez', N'Sumpango'), (N'Sacatepéquez', N'Santo Domingo Xenacoj'),
    (N'Sacatepéquez', N'Santiago Sacatepéquez'), (N'Sacatepéquez', N'San Bartolomé Milpas Altas'),
    (N'Sacatepéquez', N'San Lucas Sacatepéquez'), (N'Sacatepéquez', N'Santa Lucía Milpas Altas'),
    (N'Sacatepéquez', N'Magdalena Milpas Altas'), (N'Sacatepéquez', N'Santa María de Jesús'),
    (N'Sacatepéquez', N'Ciudad Vieja'), (N'Sacatepéquez', N'San Miguel Dueñas'), (N'Sacatepéquez', N'Alotenango'),
    (N'Sacatepéquez', N'San Antonio Aguas Calientes'), (N'Sacatepéquez', N'Santa Catarina Barahona'),

    (N'San Marcos', N'San Marcos'), (N'San Marcos', N'San Pedro Sacatepéquez'),
    (N'San Marcos', N'San Antonio Sacatepéquez'), (N'San Marcos', N'Comitancillo'),
    (N'San Marcos', N'San Miguel Ixtahuacán'), (N'San Marcos', N'Concepción Tutuapa'), (N'San Marcos', N'Tacaná'),
    (N'San Marcos', N'Sibinal'), (N'San Marcos', N'Tajumulco'), (N'San Marcos', N'Tejutla'),
    (N'San Marcos', N'San Rafael Pie de la Cuesta'), (N'San Marcos', N'Nuevo Progreso'), (N'San Marcos', N'El Tumbador'),
    (N'San Marcos', N'San José El Rodeo'), (N'San Marcos', N'Malacatán'), (N'San Marcos', N'Catarina'),
    (N'San Marcos', N'Ayutla'), (N'San Marcos', N'Ocós'), (N'San Marcos', N'San Pablo'), (N'San Marcos', N'El Quetzal'),
    (N'San Marcos', N'La Reforma'), (N'San Marcos', N'Pajapita'), (N'San Marcos', N'Ixchiguán'),
    (N'San Marcos', N'San José Ojetenam'), (N'San Marcos', N'San Cristóbal Cucho'), (N'San Marcos', N'Sipacapa'),
    (N'San Marcos', N'Esquipulas Palo Gordo'), (N'San Marcos', N'Río Blanco'), (N'San Marcos', N'San Lorenzo'),
    (N'San Marcos', N'La Blanca'),

    (N'Santa Rosa', N'Cuilapa'), (N'Santa Rosa', N'Barberena'), (N'Santa Rosa', N'Santa Rosa de Lima'),
    (N'Santa Rosa', N'Casillas'), (N'Santa Rosa', N'San Rafael Las Flores'), (N'Santa Rosa', N'Oratorio'),
    (N'Santa Rosa', N'San Juan Tecuaco'), (N'Santa Rosa', N'Chiquimulilla'), (N'Santa Rosa', N'Taxisco'),
    (N'Santa Rosa', N'Santa María Ixhuatán'), (N'Santa Rosa', N'Guazacapán'), (N'Santa Rosa', N'Santa Cruz Naranjo'),
    (N'Santa Rosa', N'Pueblo Nuevo Viñas'), (N'Santa Rosa', N'Nueva Santa Rosa'),

    (N'Sololá', N'Sololá'), (N'Sololá', N'San José Chacayá'), (N'Sololá', N'Santa María Visitación'),
    (N'Sololá', N'Santa Lucía Utatlán'), (N'Sololá', N'Nahualá'), (N'Sololá', N'Santa Catarina Ixtahuacán'),
    (N'Sololá', N'Santa Clara La Laguna'), (N'Sololá', N'Concepción'), (N'Sololá', N'San Andrés Semetabaj'),
    (N'Sololá', N'Panajachel'), (N'Sololá', N'Santa Catarina Palopó'), (N'Sololá', N'San Antonio Palopó'),
    (N'Sololá', N'San Lucas Tolimán'), (N'Sololá', N'Santa Cruz La Laguna'), (N'Sololá', N'San Pablo La Laguna'),
    (N'Sololá', N'San Marcos La Laguna'), (N'Sololá', N'San Juan La Laguna'), (N'Sololá', N'San Pedro La Laguna'),
    (N'Sololá', N'Santiago Atitlán'),

    (N'Suchitepéquez', N'Mazatenango'), (N'Suchitepéquez', N'Cuyotenango'),
    (N'Suchitepéquez', N'San Francisco Zapotitlán'), (N'Suchitepéquez', N'San Bernardino'),
    (N'Suchitepéquez', N'San José El Ídolo'), (N'Suchitepéquez', N'Santo Domingo Suchitepéquez'),
    (N'Suchitepéquez', N'San Lorenzo'), (N'Suchitepéquez', N'Samayac'), (N'Suchitepéquez', N'San Pablo Jocopilas'),
    (N'Suchitepéquez', N'San Antonio Suchitepéquez'), (N'Suchitepéquez', N'San Miguel Panán'),
    (N'Suchitepéquez', N'San Gabriel'), (N'Suchitepéquez', N'Chicacao'), (N'Suchitepéquez', N'Patulul'),
    (N'Suchitepéquez', N'Santa Bárbara'), (N'Suchitepéquez', N'San Juan Bautista'),
    (N'Suchitepéquez', N'Santo Tomás La Unión'), (N'Suchitepéquez', N'Zunilito'), (N'Suchitepéquez', N'Pueblo Nuevo'),
    (N'Suchitepéquez', N'Río Bravo'), (N'Suchitepéquez', N'San José La Máquina'),

    (N'Totonicapán', N'Totonicapán'), (N'Totonicapán', N'San Cristóbal Totonicapán'),
    (N'Totonicapán', N'San Francisco El Alto'), (N'Totonicapán', N'San Andrés Xecul'), (N'Totonicapán', N'Momostenango'),
    (N'Totonicapán', N'Santa María Chiquimula'), (N'Totonicapán', N'Santa Lucía La Reforma'),
    (N'Totonicapán', N'San Bartolo'),

    (N'Zacapa', N'Zacapa'), (N'Zacapa', N'Estanzuela'), (N'Zacapa', N'Río Hondo'), (N'Zacapa', N'Gualán'),
    (N'Zacapa', N'Teculután'), (N'Zacapa', N'Usumatlán'), (N'Zacapa', N'Cabañas'), (N'Zacapa', N'San Diego'),
    (N'Zacapa', N'La Unión'), (N'Zacapa', N'Huité'), (N'Zacapa', N'San Jorge')
) AS m (Departamento, Municipio)
JOIN dbo.Departamento AS d ON d.Nombre = m.Departamento
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.Municipio AS x WHERE x.IDDepartamento = d.IDDepartamento AND x.Nombre = m.Municipio);
