/**
 * @file ranking.js
 * @brief Carga y muestra el ranking de jugadores desde la base de datos.
 * @author Yeray y Nelson
 */

/** @brief Direccion del servidor backend */
const API = "http://localhost:3000";

/**
 * @brief Carga el ranking desde la API y lo muestra en la tabla.
 * Ordena los jugadores por victorias de mayor a menor.
 */
function cargarRanking() {
    fetch(API + "/ranking")
    .then(function(res) {
        if (!res.ok) throw new Error("Error al obtener el ranking");
        return res.json();
    })
    .then(function(jugadores) {
        try {
            var cuerpo = document.getElementById("cuerpo-ranking");
            cuerpo.innerHTML = "";

            if (jugadores.length === 0) {
                var tr = document.createElement("tr");
                var td = document.createElement("td");
                td.colSpan = 3;
                td.textContent = "Todavia no hay jugadores en el ranking. Juega una partida!";
                td.style.color = "#7A8FA6";
                tr.appendChild(td);
                cuerpo.appendChild(tr);
                return;
            }

            jugadores.forEach(function(jugador, index) {
                var tr = document.createElement("tr");

                var tdPos = document.createElement("td");
                tdPos.textContent = index + 1;

                var tdNombre = document.createElement("td");
                tdNombre.textContent = jugador.nombre;

                var tdVictorias = document.createElement("td");
                tdVictorias.textContent = jugador.partidas_ganadas;

                tr.appendChild(tdPos);
                tr.appendChild(tdNombre);
                tr.appendChild(tdVictorias);
                cuerpo.appendChild(tr);
            });
        } catch (error) {
            console.error("Error al renderizar ranking:", error);
        }
    })
    .catch(function(error) {
        console.error("Error al cargar ranking:", error);
        try {
            document.getElementById("msg-ranking").textContent = "Error al cargar el ranking. Comprueba que el servidor esta corriendo.";
            document.getElementById("msg-ranking").className = "mensaje error";
        } catch (e) {
            console.error("Error al mostrar mensaje de error:", e);
        }
    });
}

/**
 * @brief Cuando se carga la pagina, lanza la carga del ranking automaticamente.
 */
document.addEventListener("DOMContentLoaded", function() {
    cargarRanking();
});