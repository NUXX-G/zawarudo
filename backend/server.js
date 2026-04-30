// Importamos los modulos necesarios
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

// Creamos una instancia de express
const server = express();

// Habilitamos las peticiones desde el frontend
server.use(cors());
server.use(express.json());

// Puerto donde correra el servidor
const PORT = 3000;

// Pool de conexiones a mysql
const pool_mysql = mysql.createPool({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
    database: "zawarudo",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Arrancamos el servidor solo cuando la BD este conectada
function iniciarServidor() {
    pool_mysql.getConnection((error, connection) => {
        if (error) {
            console.error("Error conectando a MySQL:", error);
            process.exit(1);
        }
        connection.release();
        server.listen(PORT, () => {
            console.log("Conectado a MySQL. Servidor corriendo en http://localhost:" + PORT);
        });
    });
}

iniciarServidor();

server.post("/jugador", (req, res) => {
    const { nombre } = req.body;
    const sql = "INSERT INTO jugadores (nombre, partidas_ganadas) VALUES (?, 0)";
    pool_mysql.query(sql, [nombre], (error, resultado) => {
        if (error) {
            console.error("Error al insertar jugador:", error);
            return res.status(500).json({ error });
        }
        res.json({ id: resultado.insertId, nombre });
    });
});

// POST /palabra - Inserta una palabra y la vincula a un jugador
server.post("/palabra", (req, res) => {
    const { palabra, jugador_id } = req.body;
    const sqlPalabra = "INSERT INTO palabras (palabra) VALUES (?)";
    pool_mysql.query(sqlPalabra, [palabra], (error, resultado) => {
        if (error) {
            console.error("Error al insertar palabra:", error);
            return res.status(500).json({ error });
        }
        const palabra_id = resultado.insertId;
        const sqlRelacion = "INSERT INTO jugadores_palabras (jugador_id, palabra_id, adivinada) VALUES (?, ?, false)";
        pool_mysql.query(sqlRelacion, [jugador_id, palabra_id], (error2) => {
            if (error2) {
                console.error("Error al vincular palabra:", error2);
                return res.status(500).json({ error: error2 });
            }
            res.json({ palabra_id, jugador_id, palabra });
        });
    });
});

// GET /palabras/:id - Devuelve las palabras de un jugador (censuradas para el rival)
server.get("/palabras/:id", (req, res) => {
    const jugador_id = req.params.id;
    const sql = `
        SELECT p.id, p.palabra, jp.adivinada
        FROM palabras p
        JOIN jugadores_palabras jp ON p.id = jp.palabra_id
        WHERE jp.jugador_id = ?
    `;
    pool_mysql.query(sql, [jugador_id], (error, resultados) => {
        if (error) {
            console.error("Error al obtener palabras:", error);
            return res.status(500).json({ error });
        }
        const censuradas = resultados.map(function(fila) {
            return {
                id: fila.id,
                adivinada: fila.adivinada,
                palabra: fila.palabra
            };
        });
        res.json(censuradas);
    });
});

// GET /jugador/:id - Devuelve los datos de un jugador
server.get("/jugador/:id", (req, res) => {
    const id = req.params.id;
    const sql = "SELECT * FROM jugadores WHERE id = ?";
    pool_mysql.query(sql, [id], (error, resultados) => {
        if (error) {
            console.error("Error al obtener jugador:", error);
            return res.status(500).json({ error });
        }
        if (resultados.length === 0) {
            return res.status(404).json({ error: "Jugador no encontrado" });
        }
        res.json(resultados[0]);
    });
});

// PUT /letra - Desvela una letra en todas las palabras del jugador rival
server.put("/letra", (req, res) => {
    const { letra, jugador_id } = req.body;
    const sql = `
        SELECT p.id, p.palabra
        FROM palabras p
        JOIN jugadores_palabras jp ON p.id = jp.palabra_id
        WHERE jp.jugador_id = ? AND jp.adivinada = false
    `;
    pool_mysql.query(sql, [jugador_id], (error, resultados) => {
        if (error) {
            console.error("Error al buscar letra:", error);
            return res.status(500).json({ error });
        }
        const aparece = resultados.some(function(fila) {
            return fila.palabra.toLowerCase().includes(letra.toLowerCase());
        });
        res.json({ letra, aparece, palabras: resultados.map(function(fila) {
            return { id: fila.id, palabra: fila.palabra };
        })});
    });
});

// DELETE /palabra/:id - Elimina una palabra adivinada
server.delete("/palabra/:id", (req, res) => {
    const id = req.params.id;
    const sql = "UPDATE jugadores_palabras SET adivinada = true WHERE palabra_id = ?";
    pool_mysql.query(sql, [id], (error) => {
        if (error) {
            console.error("Error al marcar palabra:", error);
            return res.status(500).json({ error });
        }
        res.json({ mensaje: "Palabra adivinada correctamente", id });
    });
});

// PUT /jugador/:id - Actualiza las partidas ganadas
server.put("/jugador/:id", (req, res) => {
    const id = req.params.id;
    const sql = "UPDATE jugadores SET partidas_ganadas = partidas_ganadas + 1 WHERE id = ?";
    pool_mysql.query(sql, [id], (error) => {
        if (error) {
            console.error("Error al actualizar partidas ganadas:", error);
            return res.status(500).json({ error });
        }
        res.json({ mensaje: "Partidas ganadas actualizadas", id });
    });
});