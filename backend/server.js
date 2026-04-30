/**
 * @file servidor.js
 * @brief Este es el motor del juego. Se encarga de hablar con la base de datos MySQL.
 * Aqui es donde se guardan los jugadores, sus palabras y quien va ganando.
 * @author Yeray y nelson
 */

// Importamos los modulos necesarios
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

/** @brief Instancia de Express para gestionar las peticiones HTTP */
const server = express();

/** 
 * @brief Configuracion de middleware.
 * CORS permite que el frontend (puerto normal) hable con el backend (puerto 3000).
 * JSON permite que el servidor entienda cuando le enviamos datos en formato objeto.
 */
server.use(cors());
server.use(express.json());

/** @brief El puerto por el que escuchara nuestro servidor */
const PORT = 3000;

/** 
 * @brief Configuracion del grupo (pool) de conexiones a MySQL.
 * Usamos un "pool" para no tener que abrir y cerrar la conexion cada vez que alguien hace algo.
 */
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

/**
 * @brief Intenta conectar con la base de datos y, si lo logra, arranca el servidor.
 * Si la base de datos falla, el programa se cierra para no dar errores raros luego.
 */
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

/**
 * @brief RUTA: Crea un nuevo jugador en la tabla 'jugadores'.
 * Al principio, todos los jugadores empiezan con 0 partidas ganadas.
 */
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

/**
 * @brief RUTA: Guarda una palabra y la asocia a un jugador.
 * Primero mete la palabra en la tabla 'palabras' y luego crea el vinculo en 'jugadores_palabras'.
 */
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

/**
 * @brief RUTA: Trae todas las palabras que pertenecen a un jugador concreto.
 * Hace un JOIN entre las tablas para saber que palabras son de quien.
 */
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

/**
 * @brief RUTA: Busca los datos de un jugador por su ID (ej: para saber su nombre o victoriass).
 */
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

/**
 * @brief RUTA: Comprueba si una letra existe en las palabras que el rival aun no ha adivinado.
 * Recorre todas las palabras del jugador indicado y devuelve si la letra aparece o no.
 */
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

/**
 * @brief RUTA: Marca una palabra como adivinada en la base de datos.
 * No borra la palabra, solo cambia su estado a "true" (adivinada).
 */
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

/**
 * @brief RUTA: Suma una victoria al marcador del jugador que ha ganado la partida.
 */
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

/**
 * @brief RUTA: Limpia el estado de la partida para que todas las palabras vuelvan a estar ocultas.
 * Pone el campo 'adivinada' a 'false' para todo el mundo.
 */
server.put("/reset-partida", (req, res) => {
    const sql = "UPDATE jugadores_palabras SET adivinada = false";
    pool_mysql.query(sql, (error) => {
        if (error) {
            console.error("Error al resetear partida:", error);
            return res.status(500).json({ error });
        }
        res.json({ mensaje: "Partida reseteada correctamente" });
    });
});