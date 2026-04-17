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