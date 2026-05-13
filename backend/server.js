/**
 * @file server.js
 * @brief Este es el motor del juego. Se encarga de hablar con la base de datos MySQL.
 * Aqui es donde se guardan los jugadores, sus palabras y quien va ganando.
 * @author Yeray y nelson
 */

const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

/** @brief Instancia de Express para gestionar las peticiones HTTP */
const server = express();

/** 
 * @brief Configuracion de middleware.
 * CORS permite que el frontend hable con el backend.
 * JSON permite que el servidor entienda datos en formato objeto.
 */
server.use(cors());
server.use(express.json());

/** @brief El puerto por el que escuchara nuestro servidor */
const PORT = 3000;

/** 
 * @brief Configuracion del pool de conexiones a MySQL.
 * Usamos un pool para no abrir y cerrar la conexion cada vez.
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
 * @brief Intenta conectar con la base de datos y arranca el servidor si lo logra.
 * Si falla, el programa se cierra para no dar errores raros.
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
 * @brief RUTA: Crea un nuevo jugador o devuelve el existente si ya hay uno con ese nombre.
 * Asi evitamos duplicados en el ranking.
 */
server.post("/jugador", (req, res) => {
    const { nombre } = req.body;
    const sqlBuscar = "SELECT * FROM jugadores WHERE nombre = ?";
    pool_mysql.query(sqlBuscar, [nombre], (error, resultados) => {
        if (error) {
            console.error("Error al buscar jugador:", error);
            return res.status(500).json({ error });
        }
        if (resultados.length > 0) {
            return res.json({ id: resultados[0].id, nombre: resultados[0].nombre });
        }
        const sqlInsertar = "INSERT INTO jugadores (nombre, partidas_ganadas) VALUES (?, 0)";
        pool_mysql.query(sqlInsertar, [nombre], (error2, resultado) => {
            if (error2) {
                console.error("Error al insertar jugador:", error2);
                return res.status(500).json({ error: error2 });
            }
            res.json({ id: resultado.insertId, nombre });
        });
    });
});

/**
 * @brief RUTA: Guarda una palabra y la asocia a un jugador.
 * Primero borra las palabras anteriores del jugador, luego inserta la nueva.
 */
server.post("/palabra", (req, res) => {
    const { palabra, jugador_id } = req.body;
    const sqlBorrar = "DELETE FROM jugadores_palabras WHERE jugador_id = ?";
    pool_mysql.query(sqlBorrar, [jugador_id], (errorBorrar) => {
        if (errorBorrar) {
            console.error("Error al borrar palabras anteriores:", errorBorrar);
        }
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
});

/**
 * @brief RUTA: Trae todas las palabras activas de un jugador concreto.
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
 * @brief RUTA: Busca los datos de un jugador por su ID.
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
 * @brief RUTA: Devuelve todos los jugadores ordenados por partidas ganadas.
 */
server.get("/ranking", (req, res) => {
    const sql = "SELECT nombre, partidas_ganadas FROM jugadores ORDER BY partidas_ganadas DESC";
    pool_mysql.query(sql, (error, resultados) => {
        if (error) {
            console.error("Error al obtener ranking:", error);
            return res.status(500).json({ error });
        }
        res.json(resultados);
    });
});

/**
 * @brief RUTA: Comprueba si una letra existe en las palabras no adivinadas del jugador indicado.
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
 * @brief RUTA: Suma una victoria al jugador que ha ganado la partida.
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
 * @brief RUTA: Resetea todas las palabras a no adivinadas para nueva partida.
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

/**
 * @brief RUTA: Crea una nueva partida online con un codigo aleatorio de 6 caracteres.
 */
server.post("/partida", (req, res) => {
    const { jugador1_id, nivel, genero } = req.body;
    const codigo = Math.random().toString(36).substring(2, 8).toUpperCase();
    const sql = "INSERT INTO partidas (codigo, jugador1_id, turno_jugador_id, nivel, genero) VALUES (?, ?, ?, ?, ?)";
    pool_mysql.query(sql, [codigo, jugador1_id, jugador1_id, nivel, genero], (error, resultado) => {
        if (error) {
            console.error("Error al crear partida:", error);
            return res.status(500).json({ error });
        }
        res.json({ id: resultado.insertId, codigo });
    });
});

/**
 * @brief RUTA: El jugador 2 se une a una partida existente con el codigo.
 * Comprueba que el nombre del jugador 2 no sea igual al del jugador 1.
 */
server.post("/unirse", (req, res) => {
    const { codigo, jugador2_id } = req.body;
    const sqlBuscar = "SELECT * FROM partidas WHERE codigo = ? AND estado = 'esperando'";
    pool_mysql.query(sqlBuscar, [codigo], (error, resultados) => {
        if (error) {
            console.error("Error al buscar partida:", error);
            return res.status(500).json({ error });
        }
        if (resultados.length === 0) {
            return res.status(404).json({ error: "Partida no encontrada o ya en curso" });
        }
        const partida = resultados[0];
        if (partida.jugador1_id === jugador2_id) {
            return res.status(400).json({ error: "No puedes unirte a tu propia partida" });
        }
        const sqlUnirse = "UPDATE partidas SET jugador2_id = ?, estado = 'jugando' WHERE id = ?";
        pool_mysql.query(sqlUnirse, [jugador2_id, partida.id], (error2) => {
            if (error2) {
                console.error("Error al unirse:", error2);
                return res.status(500).json({ error: error2 });
            }
            res.json({ id: partida.id, codigo, nivel: partida.nivel, genero: partida.genero, jugador1_id: partida.jugador1_id });
        });
    });
});

/**
 * @brief RUTA: Devuelve el estado actual de la partida para el polling.
 */
server.get("/estado-partida/:id", (req, res) => {
    const id = req.params.id;
    const sql = "SELECT * FROM partidas WHERE id = ?";
    pool_mysql.query(sql, [id], (error, resultados) => {
        if (error) {
            console.error("Error al obtener estado:", error);
            return res.status(500).json({ error });
        }
        if (resultados.length === 0) {
            return res.status(404).json({ error: "Partida no encontrada" });
        }
        res.json(resultados[0]);
    });
});

/**
 * @brief RUTA: Marca que un jugador ya inserto todas sus palabras.
 * Incrementa el contador palabras_listas. Cuando llega a 2 ambos jugadores estan listos.
 */
server.put("/palabras-listas/:id", (req, res) => {
    const id = req.params.id;
    const sql = "UPDATE partidas SET palabras_listas = palabras_listas + 1 WHERE id = ?";
    pool_mysql.query(sql, [id], (error) => {
        if (error) {
            console.error("Error al actualizar palabras listas:", error);
            return res.status(500).json({ error });
        }
        res.json({ mensaje: "Palabras listas actualizadas" });
    });
});

/**
 * @brief RUTA: Cambia el turno al otro jugador en la partida online.
 */
server.put("/cambiar-turno/:id", (req, res) => {
    const id = req.params.id;
    const sqlBuscar = "SELECT * FROM partidas WHERE id = ?";
    pool_mysql.query(sqlBuscar, [id], (error, resultados) => {
        if (error) {
            console.error("Error al buscar partida:", error);
            return res.status(500).json({ error });
        }
        if (resultados.length === 0) {
            return res.status(404).json({ error: "Partida no encontrada" });
        }
        const partida = resultados[0];
        const nuevoTurno = partida.turno_jugador_id === partida.jugador1_id ? partida.jugador2_id : partida.jugador1_id;
        const sqlCambiar = "UPDATE partidas SET turno_jugador_id = ? WHERE id = ?";
        pool_mysql.query(sqlCambiar, [nuevoTurno, id], (error2) => {
            if (error2) {
                console.error("Error al cambiar turno:", error2);
                return res.status(500).json({ error: error2 });
            }
            res.json({ turno_jugador_id: nuevoTurno });
        });
    });
});

/**
 * @brief RUTA: Actualiza los puntos y tiempos de ambos jugadores en la partida.
 */
server.put("/puntos/:id", (req, res) => {
    const id = req.params.id;
    const { puntos_j1, puntos_j2, tiempo_j1, tiempo_j2 } = req.body;
    const sql = "UPDATE partidas SET puntos_j1 = ?, puntos_j2 = ?, tiempo_j1 = ?, tiempo_j2 = ? WHERE id = ?";
    pool_mysql.query(sql, [puntos_j1, puntos_j2, tiempo_j1, tiempo_j2, id], (error) => {
        if (error) {
            console.error("Error al actualizar puntos:", error);
            return res.status(500).json({ error });
        }
        res.json({ mensaje: "Puntos y tiempos actualizados" });
    });
});

/**
 * @brief RUTA: Marca la partida como abandonada para que el rival sepa que el jugador se fue.
 */
server.put("/abandonar-partida/:id", (req, res) => {
    const id = req.params.id;
    const sql = "UPDATE partidas SET estado = 'abandonada' WHERE id = ?";
    pool_mysql.query(sql, [id], (error) => {
        if (error) {
            console.error("Error al abandonar partida:", error);
            return res.status(500).json({ error });
        }
        res.json({ mensaje: "Partida abandonada" });
    });
});

/**
 * @brief RUTA: Marca la partida como terminada.
 */
server.put("/terminar-partida/:id", (req, res) => {
    const id = req.params.id;
    const sql = "UPDATE partidas SET estado = 'terminada' WHERE id = ?";
    pool_mysql.query(sql, [id], (error) => {
        if (error) {
            console.error("Error al terminar partida:", error);
            return res.status(500).json({ error });
        }
        res.json({ mensaje: "Partida terminada" });
    });
});