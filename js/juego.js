/**
 * @file juego.js
 * @brief Este archivo contiene toda la logica del juego: desde el registro hasta el final.
 * Incluye modo local, modo online con polling y validacion de titulos con RAWG.io.
 * @author Yeray y Nelson
 */

/** @brief La direccion donde esta escuchando nuestro servidor */
const API = "http://localhost:3000";

/** @brief La API key de RAWG.io para validar que los titulos sean videojuegos reales */
const RAWG_KEY = "1e728ef460044d1d838e3727bd988f1d";

/** @brief Los tipos de juegos que pueden salir en el sorteo */
const generos = [
    "Accion", "Aventura", "RPG", "Deportes",
    "Terror", "Estrategia", "Plataformas",
    "Lucha", "Simulacion", "Puzzle"
];

/** @brief Diccionario para saber cuantos segundos dar segun la dificultad */
const tiempos = { "1": 300, "3": 180, "5": 90 };

/** 
 * @brief La caja donde guardamos todo lo que pasa en la partida.
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
    palabrasInsertadasJ2: 0,
    online: false,
    partidaId: null,
    miJugadorId: null,
    rivalId: null,
    soyJ1: false,
    pollingInterval: null,
    pollingIntentos: 0,
    tiempoJ1: 0,
    tiempoJ2: 0,
    procesando: false
};

/** @brief Un almacen para recordar que letras ha ido diciendo cada jugador. */
var letrasReveladas = { 1: [], 2: [] };

/**
 * @brief Sirve para saltar de una parte del juego a otra.
 * @param id El nombre del div que queremos que se vea.
 */
function mostrarPantalla(id) {
    try {
        document.querySelectorAll(".pantalla").forEach(function(p) {
            p.classList.remove("activa");
        });
        document.getElementById(id).classList.add("activa");
    } catch (error) {
        console.error("Error al mostrar pantalla:", error);
    }
}

/**
 * @brief Pinta un texto en la pantalla para avisar de algo al usuario.
 * @param id Donde vamos a escribir.
 * @param texto Que vamos a escribir.
 * @param tipo Clase CSS verde (ok) o rojo (error).
 */
function mostrarMensaje(id, texto, tipo) {
    try {
        var el = document.getElementById(id);
        el.textContent = texto;
        el.className = "mensaje " + tipo;
    } catch (error) {
        console.error("Error al mostrar mensaje:", error);
    }
}

/**
 * @brief Limpia todos los mensajes y inputs de la pantalla de juego.
 */
function limpiarPantallaJuego() {
    try {
        mostrarMensaje("msg-letra", "", "");
        mostrarMensaje("msg-adivinar", "", "");
        document.getElementById("input-letra").value = "";
        document.getElementById("input-adivinar").value = "";
    } catch (error) {
        console.error("Error al limpiar pantalla juego:", error);
    }
}

/**
 * @brief Bloquea los botones de accion cuando no es el turno del jugador.
 */
function bloquearAcciones() {
    try {
        document.getElementById("btn-letra").disabled = true;
        document.getElementById("btn-adivinar").disabled = true;
        document.getElementById("input-letra").disabled = true;
        document.getElementById("input-adivinar").disabled = true;
        document.getElementById("btn-letra").style.opacity = "0.4";
        document.getElementById("btn-adivinar").style.opacity = "0.4";
    } catch (error) {
        console.error("Error al bloquear acciones:", error);
    }
}

/**
 * @brief Desbloquea los botones de accion cuando es el turno del jugador.
 */
function desbloquearAcciones() {
    try {
        document.getElementById("btn-letra").disabled = false;
        document.getElementById("btn-adivinar").disabled = false;
        document.getElementById("input-letra").disabled = false;
        document.getElementById("input-adivinar").disabled = false;
        document.getElementById("btn-letra").style.opacity = "1";
        document.getElementById("btn-adivinar").style.opacity = "1";
    } catch (error) {
        console.error("Error al desbloquear acciones:", error);
    }
}

/**
 * @brief Consulta RAWG.io para comprobar si un titulo es un videojuego real.
 * Si la API falla, deja pasar el titulo igualmente para no bloquear el juego.
 * @param titulo El nombre del videojuego a validar.
 * @return Una promesa que resuelve con true si es valido o false si no lo es.
 */
function validarTituloRawg(titulo) {
    var url = "https://api.rawg.io/api/games?key=" + RAWG_KEY + "&search=" + encodeURIComponent(titulo) + "&page_size=5&search_exact=true";
    return fetch(url)
    .then(function(res) {
        if (!res.ok) throw new Error("Error en RAWG");
        return res.json();
    })
    .then(function(data) {
        if (!data.results || data.results.length === 0) return false;
        var tituloLower = titulo.toLowerCase().trim();
        return data.results.some(function(juego) {
            return juego.name.toLowerCase().trim() === tituloLower;
        });
    })
    .catch(function(error) {
        console.error("Error al validar con RAWG:", error);
        return true;
    });
}

/**
 * @brief Arranca el reloj de la partida.
 * Cada jugador tiene su tiempo individual que se pausa cuando no es su turno.
 */
function iniciarTemporizador() {
    var tiempoActual;
    if (estado.online) {
        tiempoActual = estado.soyJ1 ? estado.tiempoJ1 : estado.tiempoJ2;
    } else {
        tiempoActual = estado.turno === 1 ? estado.tiempoJ1 : estado.tiempoJ2;
    }
    if (tiempoActual === 0) {
        tiempoActual = tiempos[String(estado.nivel)];
    }
    estado.segundosRestantes = tiempoActual;
    actualizarDisplayTemporizador();
    estado.temporizador = setInterval(function() {
        estado.segundosRestantes--;
        if (estado.online) {
            if (estado.soyJ1) {
                estado.tiempoJ1 = estado.segundosRestantes;
            } else {
                estado.tiempoJ2 = estado.segundosRestantes;
            }
        } else {
            if (estado.turno === 1) {
                estado.tiempoJ1 = estado.segundosRestantes;
            } else {
                estado.tiempoJ2 = estado.segundosRestantes;
            }
        }
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

/** @brief Para el tiempo por completo y limpia el color rojo. */
function pararTemporizador() {
    clearInterval(estado.temporizador);
    try {
        document.getElementById("temporizador").classList.remove("urgente");
    } catch (error) {
        console.error("Error al parar temporizador:", error);
    }
}

/** @brief Calcula minutos y segundos para que el reloj se vea bonito (00:00). */
function actualizarDisplayTemporizador() {
    try {
        var mins = Math.floor(estado.segundosRestantes / 60);
        var segs = estado.segundosRestantes % 60;
        document.getElementById("temporizador").textContent =
            (mins < 10 ? "0" : "") + mins + ":" + (segs < 10 ? "0" : "") + segs;
    } catch (error) {
        console.error("Error al actualizar temporizador:", error);
    }
}

/** @brief Elige un genero al azar y lo pone en el texto del menu local. */
function sortearGenero() {
    try {
        estado.genero = generos[Math.floor(Math.random() * generos.length)];
        document.getElementById("genero-sorteado").textContent = estado.genero;
    } catch (error) {
        console.error("Error al sortear genero:", error);
    }
}

/** @brief Igual que sortearGenero pero para el selector del modo online. */
function sortearGeneroOnline() {
    try {
        estado.genero = generos[Math.floor(Math.random() * generos.length)];
        document.getElementById("genero-sorteado-online").textContent = estado.genero;
    } catch (error) {
        console.error("Error al sortear genero online:", error);
    }
}

/**
 * @brief Comprueba nombres y genero y registra a los jugadores en la API (modo local).
 */
function empezarPartida() {
    try {
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
        if (nombreJ1 === nombreJ2) {
            alert("Los dos jugadores no pueden tener el mismo nombre");
            return;
        }

        fetch(API + "/jugador", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre: nombreJ1 })
        })
        .then(function(res) {
            if (!res.ok) throw new Error("Error al registrar jugador 1");
            return res.json();
        })
        .then(function(data) {
            estado.j1 = data;
            return fetch(API + "/jugador", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre: nombreJ2 })
            });
        })
        .then(function(res) {
            if (!res.ok) throw new Error("Error al registrar jugador 2");
            return res.json();
        })
        .then(function(data) {
            estado.j2 = data;
            prepararInsertarPalabras(1);
        })
        .catch(function(error) {
            console.error("Error al registrar jugadores:", error);
            alert("Error al conectar con el servidor.");
        });
    } catch (error) {
        console.error("Error en empezarPartida:", error);
    }
}

// ── MODO ONLINE ──────────────────────────────────────────

/**
 * @brief Registra al jugador 1 y lo manda a elegir nivel y genero.
 */
function crearSala() {
    try {
        var nombre = document.getElementById("nombre-online").value.trim();
        if (!nombre) {
            mostrarMensaje("msg-online", "Introduce tu nombre", "error");
            return;
        }

        fetch(API + "/jugador", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre: nombre })
        })
        .then(function(res) {
            if (!res.ok) throw new Error("Error al registrar jugador");
            return res.json();
        })
        .then(function(jugador) {
            estado.j1 = jugador;
            estado.miJugadorId = jugador.id;
            estado.soyJ1 = true;
            estado.online = true;
            mostrarPantalla("pantalla-nivel-online");
        })
        .catch(function(error) {
            console.error("Error al crear sala:", error);
            mostrarMensaje("msg-online", "Error al conectar con el servidor", "error");
        });
    } catch (error) {
        console.error("Error en crearSala:", error);
    }
}

/**
 * @brief El jugador 1 configura nivel y genero y crea la partida en el servidor.
 */
function empezarOnline() {
    try {
        if (!estado.genero) {
            alert("Sortea el genero primero");
            return;
        }
        estado.nivel = parseInt(document.getElementById("nivel-online").value);

        fetch(API + "/partida", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jugador1_id: estado.j1.id, nivel: estado.nivel, genero: estado.genero })
        })
        .then(function(res) {
            if (!res.ok) throw new Error("Error al crear partida");
            return res.json();
        })
        .then(function(partida) {
            estado.partidaId = partida.id;
            document.getElementById("codigo-generado").textContent = partida.codigo;
            mostrarPantalla("pantalla-espera");
            esperarJugador2();
        })
        .catch(function(error) {
            console.error("Error al empezar online:", error);
            alert("Error al crear la partida");
        });
    } catch (error) {
        console.error("Error en empezarOnline:", error);
    }
}

/**
 * @brief Polling: el jugador 1 espera a que el jugador 2 se una.
 * Si pasan 2 minutos sin que nadie se una, cancela la espera.
 */
function esperarJugador2() {
    estado.pollingIntentos = 0;
    estado.pollingInterval = setInterval(function() {
        estado.pollingIntentos++;
        if (estado.pollingIntentos > 60) {
            clearInterval(estado.pollingInterval);
            alert("Nadie se unio a la sala. Volviendo al menu.");
            resetearEstado();
            mostrarPantalla("pantalla-modo");
            return;
        }
        fetch(API + "/estado-partida/" + estado.partidaId)
        .then(function(res) { return res.json(); })
        .then(function(partida) {
            if (partida.estado === "jugando" && partida.jugador2_id) {
                clearInterval(estado.pollingInterval);
                fetch(API + "/jugador/" + partida.jugador2_id)
                .then(function(res) { return res.json(); })
                .then(function(j2) {
                    estado.j2 = j2;
                    estado.rivalId = j2.id;
                    prepararInsertarPalabras(1);
                })
                .catch(function(error) {
                    console.error("Error al obtener jugador 2:", error);
                });
            }
        })
        .catch(function(error) {
            console.error("Error en polling espera:", error);
        });
    }, 2000);
}

/**
 * @brief El jugador 2 se une a una sala existente con el codigo.
 * Comprueba que el nombre no sea igual al del jugador 1 antes de unirse.
 */
function unirseASala() {
    try {
        var nombre = document.getElementById("nombre-online").value.trim();
        var codigo = document.getElementById("codigo-sala").value.trim().toUpperCase();

        if (!nombre) {
            mostrarMensaje("msg-online", "Introduce tu nombre", "error");
            return;
        }
        if (!codigo || codigo.length !== 6) {
            mostrarMensaje("msg-online", "Introduce un codigo valido de 6 caracteres", "error");
            return;
        }

        fetch(API + "/jugador", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre: nombre })
        })
        .then(function(res) {
            if (!res.ok) throw new Error("Error al registrar jugador");
            return res.json();
        })
        .then(function(jugador) {
            estado.j2 = jugador;
            estado.miJugadorId = jugador.id;
            estado.soyJ1 = false;
            estado.online = true;

            return fetch(API + "/unirse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo: codigo, jugador2_id: jugador.id })
            });
        })
        .then(function(res) {
            if (!res.ok) {
                if (res.status === 400) {
                    mostrarMensaje("msg-online", "No puedes unirte con el mismo nombre que el creador", "error");
                } else {
                    mostrarMensaje("msg-online", "Sala no encontrada o ya en curso", "error");
                }
                throw new Error("Error al unirse");
            }
            return res.json();
        })
        .then(function(partida) {
            estado.partidaId = partida.id;
            estado.nivel = partida.nivel;
            estado.genero = partida.genero;
            return fetch(API + "/jugador/" + partida.jugador1_id);
        })
        .then(function(res) { return res.json(); })
        .then(function(j1) {
            estado.j1 = j1;
            estado.rivalId = j1.id;
            prepararInsertarPalabras(2);
        })
        .catch(function(error) {
            console.error("Error al unirse:", error);
        });
    } catch (error) {
        console.error("Error en unirseASala:", error);
    }
}

/**
 * @brief Polling del turno: comprueba cada 2 segundos si ambos jugadores insertaron palabras
 * y si es el turno del jugador actual. Gestiona partidas abandonadas y terminadas.
 */
function iniciarPollingTurno() {
    if (estado.pollingInterval) clearInterval(estado.pollingInterval);
    estado.pollingIntentos = 0;
    estado.pollingInterval = setInterval(function() {
        estado.pollingIntentos++;
        if (estado.pollingIntentos > 150) {
            clearInterval(estado.pollingInterval);
            alert("El rival tarda demasiado. La partida se ha cancelado.");
            resetearEstado();
            mostrarPantalla("pantalla-modo");
            return;
        }
        fetch(API + "/estado-partida/" + estado.partidaId)
        .then(function(res) { return res.json(); })
        .then(function(partida) {
            if (partida.estado === "abandonada") {
                clearInterval(estado.pollingInterval);
                alert("El rival ha abandonado la partida.");
                resetearEstado();
                mostrarPantalla("pantalla-modo");
                return;
            }
            if (partida.estado === "terminada") {
                clearInterval(estado.pollingInterval);
                try {
                    document.getElementById("titulo-ganador").textContent = "El rival ha ganado";
                    document.getElementById("texto-ganador").textContent = "The World ha parado el tiempo";
                    document.getElementById("nombre-final-j1").textContent = estado.j1.nombre;
                    document.getElementById("puntos-final-j1").textContent = partida.puntos_j1 + " puntos";
                    document.getElementById("nombre-final-j2").textContent = estado.j2.nombre;
                    document.getElementById("puntos-final-j2").textContent = partida.puntos_j2 + " puntos";
                    mostrarPantalla("pantalla-fin");
                } catch (e) {
                    console.error("Error al mostrar fin de partida:", e);
                }
                return;
            }
            if (partida.palabras_listas < 2) {
                return;
            }
            if (partida.turno_jugador_id === estado.miJugadorId) {
                clearInterval(estado.pollingInterval);
                estado.puntosJ1 = partida.puntos_j1;
                estado.puntosJ2 = partida.puntos_j2;
                estado.tiempoJ1 = partida.tiempo_j1;
                estado.tiempoJ2 = partida.tiempo_j2;
                estado.procesando = false;
                desbloquearAcciones();
                limpiarPantallaJuego();
                mostrarPantalla("pantalla-juego");
                actualizarCabeceraJuego();
                cargarTableroRival();
                iniciarTemporizador();
            } else if (partida.palabras_listas >= 2) {
                clearInterval(estado.pollingInterval);
                bloquearAcciones();
                mostrarPantalla("pantalla-espera-turno");
                iniciarPollingTurno();
            }
        })
        .catch(function(error) {
            console.error("Error en polling turno:", error);
        });
    }, 2000);
}

/**
 * @brief Crea los inputs para que el jugador introduzca sus titulos.
 * @param numJugador Para saber si le toca al Jugador 1 o al Jugador 2.
 */
function prepararInsertarPalabras(numJugador) {
    try {
        var jugador = numJugador === 1 ? estado.j1 : estado.j2;
        document.getElementById("titulo-insertar").textContent = jugador.nombre + " — introduce tus titulos";
        document.getElementById("genero-actual").textContent = "Genero: " + estado.genero;

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
    } catch (error) {
        console.error("Error al preparar insertar palabras:", error);
    }
}

/**
 * @brief Valida con RAWG y guarda los titulos del jugador en la API.
 * En modo online avisa al servidor cuando termina para sincronizar con el rival.
 * @param numJugador El jugador que esta enviando sus palabras.
 */
function guardarPalabras(numJugador) {
    try {
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

        var titulosLower = palabras.map(function(p) { return p.toLowerCase(); });
        var tituloDuplicado = titulosLower.some(function(p, i) {
            return titulosLower.indexOf(p) !== i;
        });
        if (tituloDuplicado) {
            alert("No puedes repetir titulos");
            return;
        }

        var validaciones = palabras.map(function(palabra) {
            return validarTituloRawg(palabra);
        });

        Promise.all(validaciones)
        .then(function(resultados) {
            var noValidos = palabras.filter(function(p, i) { return !resultados[i]; });
            if (noValidos.length > 0) {
                var confirmar = confirm(
                    "Los siguientes titulos no se encontraron en RAWG.io: " +
                    noValidos.join(", ") +
                    "\n¿Quieres guardarlos igualmente?"
                );
                if (!confirmar) return;
            }

            var promesas = palabras.map(function(palabra) {
                return fetch(API + "/palabra", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ palabra: palabra, jugador_id: jugador.id })
                })
                .then(function(res) {
                    if (!res.ok) throw new Error("Error al guardar palabra");
                    return res.json();
                });
            });

            Promise.all(promesas)
            .then(function() {
                if (estado.online) {
                    fetch(API + "/palabras-listas/" + estado.partidaId, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" }
                    })
                    .then(function(res) { return res.json(); })
                    .then(function() {
                        bloquearAcciones();
                        mostrarPantalla("pantalla-espera-turno");
                        iniciarPollingTurno();
                    })
                    .catch(function(error) {
                        console.error("Error al marcar palabras listas:", error);
                    });
                } else {
                    if (numJugador === 1) {
                        prepararInsertarPalabras(2);
                    } else {
                        iniciarJuego();
                    }
                }
            })
            .catch(function(error) {
                console.error("Error al guardar palabras:", error);
                alert("Error al guardar los titulos.");
            });
        })
        .catch(function(error) {
            console.error("Error al validar titulos:", error);
        });
    } catch (error) {
        console.error("Error en guardarPalabras:", error);
    }
}

/** @brief Configura la pantalla de juego y arranca el temporizador. */
function iniciarJuego() {
    try {
        estado.procesando = false;
        desbloquearAcciones();
        limpiarPantallaJuego();
        mostrarPantalla("pantalla-juego");
        actualizarCabeceraJuego();
        cargarTableroRival();
        iniciarTemporizador();
        var musicaJuego = document.querySelector(".musica-juego");
        if (musicaJuego) {
            musicaJuego.volume = 0.3;
            musicaJuego.play().catch(function(error) {
                console.error("Error al reproducir musica:", error);
            });
        }
    } catch (error) {
        console.error("Error al iniciar juego:", error);
    }
}

/** @brief Actualiza el turno y los puntos en la cabecera del juego. */
function actualizarCabeceraJuego() {
    try {
        var nombreActual;
        if (estado.online) {
            nombreActual = estado.soyJ1 ? estado.j1.nombre : estado.j2.nombre;
        } else {
            nombreActual = estado.turno === 1 ? estado.j1.nombre : estado.j2.nombre;
        }
        document.getElementById("turno-titulo").textContent = "Turno de " + nombreActual;
        document.getElementById("puntos-j1-label").textContent = estado.j1.nombre + ": ";
        document.getElementById("puntos-j2-label").textContent = estado.j2.nombre + ": ";
        document.getElementById("puntos-j1").textContent = estado.puntosJ1;
        document.getElementById("puntos-j2").textContent = estado.puntosJ2;
    } catch (error) {
        console.error("Error al actualizar cabecera:", error);
    }
}

/**
 * @brief Pide las palabras del rival y las muestra en el tablero.
 * En modo online usa rivalId directamente en vez de estado.turno.
 */
function cargarTableroRival() {
    try {
        var rivalId;
        var rivalNum;

        if (estado.online) {
            rivalId = estado.rivalId;
            rivalNum = estado.soyJ1 ? 2 : 1;
        } else {
            rivalId = estado.turno === 1 ? estado.j2.id : estado.j1.id;
            rivalNum = estado.turno === 1 ? 2 : 1;
        }

        fetch(API + "/palabras/" + rivalId)
        .then(function(res) {
            if (!res.ok) throw new Error("Error al obtener palabras del rival");
            return res.json();
        })
        .then(function(palabras) {
            try {
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
            } catch (error) {
                console.error("Error al renderizar tablero:", error);
            }
        })
        .catch(function(error) {
            console.error("Error al cargar tablero:", error);
            mostrarMensaje("msg-letra", "Error al cargar el tablero del rival", "error");
        });
    } catch (error) {
        console.error("Error en cargarTableroRival:", error);
    }
}

/**
 * @brief Decide que caracteres mostrar y cuales ocultar tras un guion.
 * @param palabra El titulo completo.
 * @param letras Las letras ya intentadas.
 * @return El string para pintar en el HTML.
 */
function revelarLetras(palabra, letras) {
    return palabra.split("").map(function(char) {
        if (char === " ") return " ";
        if (letras.indexOf(char.toLowerCase()) !== -1) return char;
        return "_";
    }).join("");
}

/**
 * @brief Cambia el turno al otro jugador y limpia los inputs.
 * En modo online guarda puntos y tiempos y luego cambia el turno en el servidor.
 */
function pasarTurno() {
    try {
        estado.procesando = false;
        bloquearAcciones();
        pararTemporizador();
        estado.turno = estado.turno === 1 ? 2 : 1;

        limpiarPantallaJuego();

        if (estado.online) {
            fetch(API + "/puntos/" + estado.partidaId, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    puntos_j1: estado.puntosJ1,
                    puntos_j2: estado.puntosJ2,
                    tiempo_j1: estado.tiempoJ1,
                    tiempo_j2: estado.tiempoJ2
                })
            })
            .then(function(res) { return res.json(); })
            .then(function() {
                return fetch(API + "/cambiar-turno/" + estado.partidaId, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" }
                });
            })
            .then(function(res) { return res.json(); })
            .then(function(data) {
                var esMiTurno = data.turno_jugador_id === estado.miJugadorId;
                if (!esMiTurno) {
                    mostrarPantalla("pantalla-espera-turno");
                    iniciarPollingTurno();
                } else {
                    estado.procesando = false;
                    desbloquearAcciones();
                    actualizarCabeceraJuego();
                    cargarTableroRival();
                    iniciarTemporizador();
                }
            })
            .catch(function(error) {
                console.error("Error al pasar turno online:", error);
            });
        } else {
            actualizarCabeceraJuego();
            cargarTableroRival();
            iniciarTemporizador();
        }
    } catch (error) {
        console.error("Error al pasar turno:", error);
    }
}

/**
 * @brief Valida la letra del usuario y pregunta al servidor si aparece en las palabras del rival.
 * Usa el flag procesando para evitar que se ejecute mas de una vez a la vez.
 */
function proponerLetra() {
    try {
        if (estado.procesando) return;
        estado.procesando = true;

        var letra = document.getElementById("input-letra").value.trim();

        if (!letra || letra.length !== 1) {
            mostrarMensaje("msg-letra", "Introduce una sola letra o numero", "error");
            estado.procesando = false;
            return;
        }
        if (!/^[a-zA-Z0-9]$/.test(letra)) {
            mostrarMensaje("msg-letra", "Solo se permiten letras y numeros", "error");
            estado.procesando = false;
            return;
        }

        var letraLower = letra.toLowerCase();
        var rivalNum = estado.online ? (estado.soyJ1 ? 2 : 1) : (estado.turno === 1 ? 2 : 1);

        if (letrasReveladas[rivalNum].includes(letraLower)) {
            mostrarMensaje("msg-letra", "Esa letra ya fue usada", "error");
            estado.procesando = false;
            return;
        }

        var rivalId = estado.online ? estado.rivalId : (estado.turno === 1 ? estado.j2.id : estado.j1.id);

        fetch(API + "/letra", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ letra: letraLower, jugador_id: rivalId })
        })
        .then(function(res) {
            if (!res.ok) throw new Error("Error al proponer letra");
            return res.json();
        })
        .then(function(data) {
            try {
                letrasReveladas[rivalNum].push(letraLower);

                if (data.aparece) {
                    var apariciones = 0;
                    data.palabras.forEach(function(p) {
                        var regex = new RegExp(letraLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "gi");
                        var matches = p.palabra.match(regex);
                        if (matches) apariciones += matches.length;
                    });

                    var puntos = apariciones * 5;
                    if (estado.online) {
                        if (estado.soyJ1) {
                            estado.puntosJ1 += puntos;
                        } else {
                            estado.puntosJ2 += puntos;
                        }
                    } else {
                        if (estado.turno === 1) {
                            estado.puntosJ1 += puntos;
                        } else {
                            estado.puntosJ2 += puntos;
                        }
                    }

                    mostrarMensaje("msg-letra",
                        "La letra " + letraLower.toUpperCase() +
                        " aparece " + apariciones +
                        " vez/veces — +" + puntos + " puntos", "ok");

                    cargarTableroRival();
                    actualizarCabeceraJuego();
                    estado.procesando = false;
                } else {
                    mostrarMensaje("msg-letra",
                        "La letra " + letraLower.toUpperCase() +
                        " no aparece — pierdes el turno", "error");
                    setTimeout(pasarTurno, 1500);
                }

                document.getElementById("input-letra").value = "";
            } catch (error) {
                console.error("Error al procesar respuesta de letra:", error);
                estado.procesando = false;
            }
        })
        .catch(function(error) {
            console.error("Error al proponer letra:", error);
            mostrarMensaje("msg-letra", "Error al conectar con el servidor", "error");
            estado.procesando = false;
        });
    } catch (error) {
        console.error("Error en proponerLetra:", error);
        estado.procesando = false;
    }
}

/**
 * @brief Comprueba si el titulo escrito coincide con alguno del rival.
 * Usa el flag procesando para evitar que se ejecute mas de una vez a la vez.
 */
function adivinarTitulo() {
    try {
        if (estado.procesando) return;
        estado.procesando = true;

        var intento = document.getElementById("input-adivinar").value.trim().toLowerCase();
        if (!intento) {
            mostrarMensaje("msg-adivinar", "Escribe un titulo", "error");
            estado.procesando = false;
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
            .then(function(res) {
                if (!res.ok) throw new Error("Error al eliminar palabra");
                return res.json();
            })
            .then(function() {
                try {
                    var bonus = estado.segundosRestantes > tiempos[String(estado.nivel)] / 2 ? 20 : 0;
                    var puntos = 50 + bonus;
                    if (estado.online) {
                        if (estado.soyJ1) {
                            estado.puntosJ1 += puntos;
                        } else {
                            estado.puntosJ2 += puntos;
                        }
                    } else {
                        if (estado.turno === 1) {
                            estado.puntosJ1 += puntos;
                        } else {
                            estado.puntosJ2 += puntos;
                        }
                    }
                    mostrarMensaje("msg-adivinar", "Correcto — +" + puntos + " puntos", "ok");
                    document.getElementById("input-adivinar").value = "";
                    actualizarCabeceraJuego();
                    cargarTableroRival();
                    estado.procesando = false;
                } catch (error) {
                    console.error("Error al procesar titulo adivinado:", error);
                    estado.procesando = false;
                }
            })
            .catch(function(error) {
                console.error("Error al adivinar titulo:", error);
                mostrarMensaje("msg-adivinar", "Error al conectar con el servidor", "error");
                estado.procesando = false;
            });
        } else {
            mostrarMensaje("msg-adivinar", "Incorrecto — pierdes el turno", "error");
            setTimeout(pasarTurno, 1500);
        }
    } catch (error) {
        console.error("Error en adivinarTitulo:", error);
        estado.procesando = false;
    }
}

/**
 * @brief Cierra la partida, guarda puntos finales, actualiza victorias y muestra el marcador.
 */
function finPartida() {
    try {
        pararTemporizador();
        if (estado.pollingInterval) clearInterval(estado.pollingInterval);

        var ganador = estado.online
            ? (estado.soyJ1 ? estado.j1 : estado.j2)
            : (estado.turno === 1 ? estado.j1 : estado.j2);

        if (estado.online) {
            fetch(API + "/puntos/" + estado.partidaId, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    puntos_j1: estado.puntosJ1,
                    puntos_j2: estado.puntosJ2,
                    tiempo_j1: estado.tiempoJ1,
                    tiempo_j2: estado.tiempoJ2
                })
            })
            .then(function(res) { return res.json(); })
            .then(function() {
                return fetch(API + "/terminar-partida/" + estado.partidaId, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" }
                });
            })
            .then(function(res) { return res.json(); })
            .catch(function(error) {
                console.error("Error al terminar partida online:", error);
            });
        }

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

        try {
            document.getElementById("titulo-ganador").textContent = "¡" + ganador.nombre + " gana!";
            document.getElementById("texto-ganador").textContent = "The World ha parado el tiempo";
            document.getElementById("nombre-final-j1").textContent = estado.j1.nombre;
            document.getElementById("puntos-final-j1").textContent = estado.puntosJ1 + " puntos";
            document.getElementById("nombre-final-j2").textContent = estado.j2.nombre;
            document.getElementById("puntos-final-j2").textContent = estado.puntosJ2 + " puntos";
            mostrarPantalla("pantalla-fin");
        } catch (error) {
            console.error("Error al mostrar pantalla fin:", error);
        }

        letrasReveladas = { 1: [], 2: [] };
        var musicaJuego = document.querySelector(".musica-juego");
        if (musicaJuego) musicaJuego.pause();
    } catch (error) {
        console.error("Error en finPartida:", error);
    }
}

/**
 * @brief Resetea el estado completo para volver a empezar desde cero.
 */
function resetearEstado() {
    if (estado.pollingInterval) clearInterval(estado.pollingInterval);
    if (estado.temporizador) clearInterval(estado.temporizador);
    estado = {
        j1: null, j2: null, nivel: 1, genero: "",
        turno: 1, puntosJ1: 0, puntosJ2: 0,
        temporizador: null, segundosRestantes: 0,
        palabrasInsertadasJ1: 0, palabrasInsertadasJ2: 0,
        online: false, partidaId: null, miJugadorId: null,
        rivalId: null, soyJ1: false, pollingInterval: null,
        pollingIntentos: 0, tiempoJ1: 0, tiempoJ2: 0,
        procesando: false
    };
    letrasReveladas = { 1: [], 2: [] };
}

/**
 * @brief Aqui escuchamos las acciones del usuario.
 * Preparamos todos los botones y teclas Enter cuando se carga el documento.
 */
document.addEventListener("DOMContentLoaded", function() {

    document.getElementById("btn-modo-local").addEventListener("click", function() {
        estado.online = false;
        mostrarPantalla("pantalla-registro");
    });

    document.getElementById("btn-modo-online").addEventListener("click", function() {
        mostrarPantalla("pantalla-online");
    });

    document.getElementById("btn-crear-sala").addEventListener("click", function() {
        crearSala();
    });

    document.getElementById("btn-unirse-sala").addEventListener("click", function() {
        unirseASala();
    });

    document.getElementById("btn-sortear-online").addEventListener("click", function() {
        sortearGeneroOnline();
    });

    document.getElementById("btn-empezar-online").addEventListener("click", function() {
        empezarOnline();
    });

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
        resetearEstado();
        try {
            document.getElementById("nombre-j1").value = "";
            document.getElementById("nombre-j2").value = "";
            document.getElementById("genero-sorteado").textContent = "—";
            document.getElementById("nombre-online").value = "";
            document.getElementById("codigo-sala").value = "";
            mostrarMensaje("msg-online", "", "");
        } catch (e) {}
        mostrarPantalla("pantalla-modo");
    });

    window.addEventListener("beforeunload", function() {
        if (estado.online && estado.partidaId) {
            fetch(API + "/abandonar-partida/" + estado.partidaId, {
                method: "PUT",
                headers: { "Content-Type": "application/json" }
            });
        }
    });

});