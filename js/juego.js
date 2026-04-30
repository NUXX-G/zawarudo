/**
 * @file juego.js
 * @brief Este archivo contiene toda la "chicha" del juego: desde el registro hasta el final.
 * @author Yeray y Nelson
 */

/** @brief La direccion donde esta escuchando nuestro servidor (el backend) */
const API = "http://localhost:3000";

/** @brief Los tipos de juegos que pueden salir en el sorteo */
const generos = [
    "Accion", "Aventura", "RPG", "Deportes",
    "Terror", "Estrategia", "Plataformas",
    "Lucha", "Simulacion", "Puzzle"
];

/** @brief Diccionario para saber cuantos segundos dar segun la dificultad (1, 3 o 5) */
const tiempos = { "1": 300, "3": 180, "5": 90 };

/** 
 * @brief La "caja" donde guardamos todo lo que pasa en la partida.
 * Aqui controlamos quien juega, que nivel hay, los puntos y el reloj.
 */
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

/**
 * @brief Sirve para saltar de una parte del juego a otra (ej: del registro al juego).
 * Lo que hace es quitarle la clase "activa" a todas las pantallas y darsela solo a la que queremos.
 * @param id El nombre del div que queremos que se vea.
 */
function mostrarPantalla(id) {
    document.querySelectorAll(".pantalla").forEach(function(p) {
        p.classList.remove("activa");
    });
    document.getElementById(id).classList.add("activa");
}

/**
 * @brief Pinta un texto en la pantalla para avisar de algo al usuario.
 * @param id Donde vamos a escribir.
 * @param texto Que vamos a escribir (ej: "¡Has acertado!").
 * @param tipo Clase CSS para que el mensaje salga en verde (ok) o rojo (error).
 */
function mostrarMensaje(id, texto, tipo) {
    var el = document.getElementById(id);
    el.textContent = texto;
    el.className = "mensaje " + tipo;
}

/**
 * @brief Convierte una palabra normala en una fila de guiones.
 * Es util para cuando queremos que el rival no vea el titulo directamente.
 * @param palabra El texto original.
 * @return El texto transformado (ej: "Zelda" -> "_____").
 */
function censurarPalabra(palabra) {
    return palabra.replace(/[a-zA-Z]/g, "_");
}

/**
 * @brief Arranca el reloj de la partida. 
 * Cada segundo resta 1 al contador y actualiza lo que ve el usuario.
 * Si quedan menos de 10 segundos, el reloj se pone en rojo ("urgente").
 */
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

/** @brief Para el tiempo por completo y limpia el color rojo de urgencia. */
function pararTemporizador() {
    clearInterval(estado.temporizador);
    document.getElementById("temporizador").classList.remove("urgente");
}

/** @brief Calcula los minutos y segundos para que el reloj se vea bonito (00:00). */
function actualizarDisplayTemporizador() {
    var mins = Math.floor(estado.segundosRestantes / 60);
    var segs = estado.segundosRestantes % 60;
    document.getElementById("temporizador").textContent =
        (mins < 10 ? "0" : "") + mins + ":" + (segs < 10 ? "0" : "") + segs;
}

/** @brief Elige un genero de la lista al azar y lo pone en el texto del menu. */
function sortearGenero() {
    estado.genero = generos[Math.floor(Math.random() * generos.length)];
    document.getElementById("genero-sorteado").textContent = estado.genero;
}

/**
 * @brief Comprueba que los nombres y el genero esten listos y registra a los jugadores en la API.
 * Usa "fetch" para enviar los nombres al servidor y espera a que este le responda.
 */
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

/**
 * @brief Crea dinamicamente tantos cuadros de texto como titulos haya que meter.
 * Dependiendo de si el nivel es 1, 3 o 5, apareceran mas o menos inputs en pantalla.
 * @param numJugador Para saber si le toca escribir al Jugador 1 o al Jugador 2.
 */
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

/**
 * @brief Recoge lo que el jugador ha escrito y lo manda a la API para guardarlo.
 * @param numJugador El jugador que esta enviando sus palabras.
 */
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

/** @brief Configura la pantalla de juego, pone el volumen de la musica y lanza el tiempo. */
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

/** @brief Actualiza los textos de arriba: de quien es el turno y cuantos puntos lleva cada uno. */
function actualizarCabeceraJuego() {
    var jugadorActual = estado.turno === 1 ? estado.j1 : estado.j2;
    document.getElementById("turno-titulo").textContent =
        "Turno de " + jugadorActual.nombre;
    document.getElementById("puntos-j1-label").textContent = estado.j1.nombre + ": ";
    document.getElementById("puntos-j2-label").textContent = estado.j2.nombre + ": ";
    document.getElementById("puntos-j1").textContent = estado.puntosJ1;
    document.getElementById("puntos-j2").textContent = estado.puntosJ2;
}

/** @brief Un almacen para recordar que letras ha ido diciendo cada jugador. */
var letrasReveladas = { 1: [], 2: [] };

/**
 * @brief Pide a la API las palabras que el rival ha escondido y las muestra en el tablero.
 * Si una palabra ya se adivino, sale completa. Si no, sale con guiines y las letras que ya se sepan.
 */
function cargarTableroRival() {
    var rivalId = estado.turno === 1 ? estado.j2.id : estado.j1.id;
    var rivalNum = estado.turno === 1 ? 2 : 1;

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
                var revelada = revelarLetras(p.palabra, letrasReveladas[rivalNum]);
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

/**
 * @brief Decide que caracteres mostrar y cuales ocultar tras un guion.
 * @param palabra El titulo completo.
 * @param letras El conjunto de letras que el jugador ya ha intentado.
 * @return El string resultante para pintar en el HTML.
 */
function revelarLetras(palabra, letras) {
    return palabra.split("").map(function(char) {
        if (char === " ") return " ";
        if (letras.indexOf(char.toLowerCase()) !== -1) return char;
        return "_";
    }).join("");
}

/** @brief Detiene todo, cambia el turno al otro jugador, limpia los inputs y vuelve a empezar el reloj. */
function pasarTurno() {
    pararTemporizador();
    estado.turno = estado.turno === 1 ? 2 : 1;
    actualizarCabeceraJuego();
    cargarTableroRival();
    mostrarMensaje("msg-letra", "", "");
    mostrarMensaje("msg-adivinar", "", "");
    document.getElementById("input-letra").value = "";
    document.getElementById("input-adivinar").value = "";
    iniciarTemporizador();
}

/**
 * @brief Se encarga de validar la letra que escribe el usuario.
 * Pregunta al servidor si esa letra esta en las palabras del rival. 
 * Si esta, suma puntos; si no, el jugador pierde el turno tras un breve retardo.
 */
function proponerLetra() {
    var letra = document.getElementById("input-letra").value.trim();

    if (!letra || letra.length !== 1) {
        mostrarMensaje("msg-letra", "Introduce una sola letra", "error");
        return;
    }

    var letraLower = letra.toLowerCase();
    var rivalNum = estado.turno === 1 ? 2 : 1;

    if (letrasReveladas[rivalNum].includes(letraLower)) {
        mostrarMensaje("msg-letra", "Esa letra ya fue usada", "error");
        return;
    }

    var rivalId = estado.turno === 1 ? estado.j2.id : estado.j1.id;

    fetch(API + "/letra", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letra: letraLower, jugador_id: rivalId })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {

        letrasReveladas[rivalNum].push(letraLower);

        if (data.aparece) {
            var apariciones = 0;

            data.palabras.forEach(function(p) {
                var regex = new RegExp(letraLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi");
                var matches = p.palabra.match(regex);
                if (matches) apariciones += matches.length;
            });

            var puntos = apariciones * 5;

            if (estado.turno === 1) {
                estado.puntosJ1 += puntos;
            } else {
                estado.puntosJ2 += puntos;
            }

            mostrarMensaje(
                "msg-letra",
                "La letra " + letraLower.toUpperCase() +
                " aparece " + apariciones +
                " vez/veces — +" + puntos + " puntos",
                "ok"
            );

            cargarTableroRival();
            actualizarCabeceraJuego();

        } else {
            mostrarMensaje(
                "msg-letra",
                "La letra " + letraLower.toUpperCase() +
                " no aparece — pierdes el turno",
                "error"
            );
            setTimeout(pasarTurno, 1500);
        }

        document.getElementById("input-letra").value = "";
    })
    .catch(function(error) {
        console.error("Error al proponer letra:", error);
    });
}

/**
 * @brief Comprueba si el texto que ha escrito el usuario coincide exactamente con algun titulo del rival.
 * Si acierta, borra la palabra de la lista "pendiente" y da puntos extra si lo hizo rapido.
 */
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

/**
 * @brief Se encarga de cerrar la partida.
 * Para el reloj, avisa al servidor para limpiar los datos y enseña el marcador final con el ganador.
 */
function finPartida() {
    pararTemporizador();
    var ganador = estado.turno === 1 ? estado.j1 : estado.j2;

    fetch(API + "/reset-partida", {
        method: "PUT",
        headers: { "Content-Type": "application/json" }
    })
    .then(function(res) { return res.json(); })
    .then(function() {
        return fetch(API + "/jugador/" + ganador.id, {
            method: "PUT",
            headers: { "Content-Type": "application/json" }
        });
    })
    .then(function(res) { return res.json(); })
    .catch(function(error) {
        console.error("Error en fin de partida:", error);
    });

    document.getElementById("titulo-ganador").textContent = "¡" + ganador.nombre + " gana!";
    document.getElementById("texto-ganador").textContent = "The World ha parado el tiempo";
    document.getElementById("nombre-final-j1").textContent = estado.j1.nombre;
    document.getElementById("puntos-final-j1").textContent = estado.puntosJ1 + " puntos";
    document.getElementById("nombre-final-j2").textContent = estado.j2.nombre;
    document.getElementById("puntos-final-j2").textContent = estado.puntosJ2 + " puntos";

    mostrarPantalla("pantalla-fin");

    letrasReveladas = { 1: [], 2: [] };
    var musicaJuego = document.querySelector(".musica-juego");
    if (musicaJuego) musicaJuego.pause();
}

/**
 * @brief Aqui "escuchamos" las acciones del usuario.
 * Cuando se carga el documento, preparamos todos los botones y las teclas "Enter" para que funcionen.
 */
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