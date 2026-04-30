const API = "http://localhost:3000";

const generos = [
    "Accion", "Aventura", "RPG", "Deportes",
    "Terror", "Estrategia", "Plataformas",
    "Lucha", "Simulacion", "Puzzle"
];

const tiempos = { "1": 300, "3": 180, "5": 90 };

var estado = {
    j1: null,
    j2: null,
    nivel: 1,
    genero: "",
    turno: 1,
    puntosJ1: 0,
    puntosJ2: 0,
    temporizador: null,
    segundosRestantes: 0,
    palabrasInsertadasJ1: 0,
    palabrasInsertadasJ2: 0
};

function mostrarPantalla(id) {
    document.querySelectorAll(".pantalla").forEach(function(p) {
        p.classList.remove("activa");
    });
    document.getElementById(id).classList.add("activa");
}

function mostrarMensaje(id, texto, tipo) {
    var el = document.getElementById(id);
    el.textContent = texto;
    el.className = "mensaje " + tipo;
}

function censurarPalabra(palabra) {
    return palabra.replace(/[a-zA-Z]/g, "_");
}

function iniciarTemporizador() {
    estado.segundosRestantes = tiempos[String(estado.nivel)];
    actualizarDisplayTemporizador();
    estado.temporizador = setInterval(function() {
        estado.segundosRestantes--;
        actualizarDisplayTemporizador();
        if (estado.segundosRestantes <= 10) {
            document.getElementById("temporizador").classList.add("urgente");
        }
        if (estado.segundosRestantes <= 0) {
            clearInterval(estado.temporizador);
            pasarTurno();
        }
    }, 1000);
}

function pararTemporizador() {
    clearInterval(estado.temporizador);
    document.getElementById("temporizador").classList.remove("urgente");
}

function actualizarDisplayTemporizador() {
    var mins = Math.floor(estado.segundosRestantes / 60);
    var segs = estado.segundosRestantes % 60;
    document.getElementById("temporizador").textContent =
        (mins < 10 ? "0" : "") + mins + ":" + (segs < 10 ? "0" : "") + segs;
}

function sortearGenero() {
    estado.genero = generos[Math.floor(Math.random() * generos.length)];
    document.getElementById("genero-sorteado").textContent = estado.genero;
}

function empezarPartida() {
    var nombreJ1 = document.getElementById("nombre-j1").value.trim();
    var nombreJ2 = document.getElementById("nombre-j2").value.trim();
    estado.nivel = parseInt(document.getElementById("nivel").value);

    if (!nombreJ1 || !nombreJ2) {
        alert("Ponle un nombre a los dos jugadores");
        return;
    }
    if (!estado.genero) {
        alert("Sortea el genero primero");
        return;
    }

    fetch(API + "/jugador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreJ1 })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        estado.j1 = data;
        return fetch(API + "/jugador", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre: nombreJ2 })
        });
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        estado.j2 = data;
        prepararInsertarPalabras(1);
    })
    .catch(function(error) {
        console.error("Error al registrar jugadores:", error);
        alert("Error al conectar con el servidor");
    });
}

function prepararInsertarPalabras(numJugador) {
    var jugador = numJugador === 1 ? estado.j1 : estado.j2;
    document.getElementById("titulo-insertar").textContent =
        jugador.nombre + " — introduce tus titulos";
    document.getElementById("genero-actual").textContent =
        "Genero: " + estado.genero;

    var contenedor = document.getElementById("inputs-palabras");
    contenedor.innerHTML = "";
    for (var i = 0; i < estado.nivel; i++) {
        var input = document.createElement("input");
        input.type = "text";
        input.className = "input-palabra";
        input.placeholder = "Titulo " + (i + 1);
        input.style.cssText = "background:#1a1a1a;border:2px solid #F0C040;color:#fff;padding:12px 16px;font-size:16px;font-family:Arial;outline:none;width:100%;margin-bottom:8px;";
        contenedor.appendChild(input);
    }

    document.getElementById("btn-guardar-palabras").onclick = function() {
        guardarPalabras(numJugador);
    };

    mostrarPantalla("pantalla-palabras");
}

function guardarPalabras(numJugador) {
    var jugador = numJugador === 1 ? estado.j1 : estado.j2;
    var inputs = document.querySelectorAll(".input-palabra");
    var palabras = [];

    inputs.forEach(function(input) {
        if (input.value.trim()) {
            palabras.push(input.value.trim());
        }
    });

    if (palabras.length < estado.nivel) {
        alert("Rellena todos los titulos");
        return;
    }

    var promesas = palabras.map(function(palabra) {
        return fetch(API + "/palabra", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ palabra: palabra, jugador_id: jugador.id })
        }).then(function(res) { return res.json(); });
    });

    Promise.all(promesas)
    .then(function() {
        if (numJugador === 1) {
            prepararInsertarPalabras(2);
        } else {
            iniciarJuego();
        }
    })
    .catch(function(error) {
        console.error("Error al guardar palabras:", error);
        alert("Error al guardar los titulos");
    });
}

function iniciarJuego() {
    mostrarPantalla("pantalla-juego");
    actualizarCabeceraJuego();
    cargarTableroRival();
    iniciarTemporizador();
    var musicaJuego = document.querySelector(".musica-juego");
    if (musicaJuego) {
        musicaJuego.volume = 0.3;
        musicaJuego.play();
    }
}

function actualizarCabeceraJuego() {
    var jugadorActual = estado.turno === 1 ? estado.j1 : estado.j2;
    document.getElementById("turno-titulo").textContent =
        "Turno de " + jugadorActual.nombre;
    document.getElementById("puntos-j1-label").textContent = estado.j1.nombre + ": ";
    document.getElementById("puntos-j2-label").textContent = estado.j2.nombre + ": ";
    document.getElementById("puntos-j1").textContent = estado.puntosJ1;
    document.getElementById("puntos-j2").textContent = estado.puntosJ2;
}

var letrasReveladas = [];

function cargarTableroRival() {
    var rivalId = estado.turno === 1 ? estado.j2.id : estado.j1.id;
    fetch(API + "/palabras/" + rivalId)
    .then(function(res) { return res.json(); })
    .then(function(palabras) {
        var contenedor = document.getElementById("lista-palabras-rival");
        contenedor.innerHTML = "";
        var todasAdivinadas = palabras.every(function(p) { return p.adivinada; });
        if (todasAdivinadas && palabras.length > 0) {
            finPartida();
            return;
        }
        palabras.forEach(function(p) {
            var div = document.createElement("div");
            div.className = "palabra-rival" + (p.adivinada ? " adivinada" : "");
            div.setAttribute("data-id", p.id);
            div.setAttribute("data-palabra", p.palabra);
            if (p.adivinada) {
                div.textContent = p.palabra;
            } else {
                var revelada = revelarLetras(p.palabra, letrasReveladas);
                div.textContent = revelada;
                if (revelada.replace(/ /g, "") === p.palabra.replace(/ /g, "")) {
                    div.classList.add("adivinada");
                }
            }
            contenedor.appendChild(div);
        });

        var todasReveladas = Array.from(contenedor.querySelectorAll(".palabra-rival")).every(function(d) {
         return d.classList.contains("adivinada");
        });
        if (todasReveladas && palabras.length > 0) {
        finPartida();
        }
    })
    .catch(function(error) {
        console.error("Error al cargar tablero:", error);
    });
}

function revelarLetras(palabra, letras) {
    return palabra.split("").map(function(char) {
        if (char === " ") return " ";
        if (letras.indexOf(char.toLowerCase()) !== -1) return char;
        return "_";
    }).join("");
}

function pasarTurno() {
    pararTemporizador();
    estado.turno = estado.turno === 1 ? 2 : 1;
    actualizarCabeceraJuego();
    cargarTableroRival();
    mostrarMensaje("msg-letra", "", "");
    mostrarMensaje("msg-adivinar", "", "");
    document.getElementById("input-letra").value = "";
    document.getElementById("input-adivinar").value = "";
    letrasReveladas = [];
    iniciarTemporizador();
}

function proponerLetra() {
    var letra = document.getElementById("input-letra").value.trim();
    if (!letra || letra.length !== 1) {
        mostrarMensaje("msg-letra", "Introduce una sola letra", "error");
        return;
    }

    var rivalId = estado.turno === 1 ? estado.j2.id : estado.j1.id;

    fetch(API + "/letra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letra: letra, jugador_id: rivalId })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
        if (data.aparece) {
            var apariciones = 0;
            data.palabras.forEach(function(p) {
                var regex = new RegExp(letra, "gi");
                var matches = p.palabra.match(regex);
                if (matches) apariciones += matches.length;
            });

            letrasReveladas.push(letra.toLowerCase());

            if (estado.turno === 1) {
                estado.puntosJ1 += apariciones * 5;
            } else {
                estado.puntosJ2 += apariciones * 5;
            }
            mostrarMensaje("msg-letra", "La letra " + letra.toUpperCase() + " aparece " + apariciones + " vez/veces — +" + (apariciones * 5) + " puntos", "ok");
            cargarTableroRival();
            actualizarCabeceraJuego();
        } else {
            mostrarMensaje("msg-letra", "La letra " + letra.toUpperCase() + " no aparece — pierdes el turno", "error");
            setTimeout(pasarTurno, 1500);
        }
        document.getElementById("input-letra").value = "";
    })
    .catch(function(error) {
        console.error("Error al proponer letra:", error);
    });
}

function adivinarTitulo() {
    var intento = document.getElementById("input-adivinar").value.trim().toLowerCase();
    if (!intento) {
        mostrarMensaje("msg-adivinar", "Escribe un titulo", "error");
        return;
    }

    var palabrasRival = document.querySelectorAll(".palabra-rival:not(.adivinada)");
    var acertada = null;

    palabrasRival.forEach(function(div) {
        if (div.getAttribute("data-palabra").toLowerCase() === intento) {
            acertada = div;
        }
    });

    if (acertada) {
        var id = acertada.getAttribute("data-id");
        fetch(API + "/palabra/" + id, { method: "DELETE" })
        .then(function(res) { return res.json(); })
        .then(function() {
            var bonus = estado.segundosRestantes > tiempos[String(estado.nivel)] / 2 ? 20 : 0;
            var puntos = 50 + bonus;
            if (estado.turno === 1) {
                estado.puntosJ1 += puntos;
            } else {
                estado.puntosJ2 += puntos;
            }
            mostrarMensaje("msg-adivinar", "Correcto — +" + puntos + " puntos", "ok");
            document.getElementById("input-adivinar").value = "";
            actualizarCabeceraJuego();
            cargarTableroRival();
        })
        .catch(function(error) {
            console.error("Error al adivinar:", error);
        });
    } else {
        mostrarMensaje("msg-adivinar", "Incorrecto — pierdes el turno", "error");
        setTimeout(pasarTurno, 1500);
    }
}

function finPartida() {
    pararTemporizador();
    var ganador = estado.turno === 1 ? estado.j1 : estado.j2;

    fetch(API + "/jugador/" + ganador.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" }
    })
    .then(function(res) { return res.json(); })
    .catch(function(error) {
        console.error("Error al actualizar partidas ganadas:", error);
    });

    document.getElementById("titulo-ganador").textContent = "¡" + ganador.nombre + " gana!";
    document.getElementById("texto-ganador").textContent = "The World ha parado el tiempo";
    document.getElementById("nombre-final-j1").textContent = estado.j1.nombre;
    document.getElementById("puntos-final-j1").textContent = estado.puntosJ1 + " puntos";
    document.getElementById("nombre-final-j2").textContent = estado.j2.nombre;
    document.getElementById("puntos-final-j2").textContent = estado.puntosJ2 + " puntos";

    mostrarPantalla("pantalla-fin");

    var musicaJuego = document.querySelector(".musica-juego");
    if (musicaJuego) musicaJuego.pause();
}

document.addEventListener("DOMContentLoaded", function() {

    document.getElementById("btn-sortear").addEventListener("click", function() {
        sortearGenero();
    });

    document.getElementById("btn-empezar").addEventListener("click", function() {
        empezarPartida();
    });

    document.getElementById("btn-letra").addEventListener("click", function() {
        proponerLetra();
    });

    document.getElementById("input-letra").addEventListener("keydown", function(e) {
        if (e.key === "Enter") proponerLetra();
    });

    document.getElementById("btn-adivinar").addEventListener("click", function() {
        adivinarTitulo();
    });

    document.getElementById("input-adivinar").addEventListener("keydown", function(e) {
        if (e.key === "Enter") adivinarTitulo();
    });

    document.getElementById("btn-jugar-otra").addEventListener("click", function() {
        estado = {
            j1: null, j2: null, nivel: 1, genero: "",
            turno: 1, puntosJ1: 0, puntosJ2: 0,
            temporizador: null, segundosRestantes: 0,
            palabrasInsertadasJ1: 0, palabrasInsertadasJ2: 0
        };
        document.getElementById("nombre-j1").value = "";
        document.getElementById("nombre-j2").value = "";
        document.getElementById("genero-sorteado").textContent = "—";
        mostrarPantalla("pantalla-registro");
    });

});