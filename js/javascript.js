/**
 * @file index.js
 * @brief Este script se encarga de configurar el menu principal antes de empezar a jugar.
 * @author Nelson y yeray
 */

/** 
 * @brief Lista de rutas a las imagenes que sirven de icono para la pestaña del navegador.
 * Tenemos tres versiones diferentes para que el juego no sea siempre igual.
 */
const favicons = [
    "recursos/imagenes/faviconV1.png",
    "recursos/imagenes/faviconV2.png",
    "recursos/imagenes/faviconV3.png"
    ]

/**
 * @brief Espera a que el HTML este cargado para poder buscar los botones y la musica.
 * Si intentaramos buscar un boton antes de que el HTML exista, el codigo daria error.
 */
document.addEventListener("DOMContentLoaded", function() {

    /** @brief Guardamos el boton de jugar y el elemento de audio en variables */
    var btnJugar = document.getElementById("btn-jugar");
    var musicaMenu = document.getElementById("musica-menu");

    /** 
     * @brief Aqui elegimos un icono al azar de nuestra lista (favicons).
     * Usamos Math.random para sacar un numero y Math.floor para redondearlo.
     */
    const favicon = favicons[Math.floor(Math.random() * favicons.length)];
    const linkFavi = document.getElementById("favicon");
    
    /** @brief Cambiamos el enlace del icono en el HTML por el que nos ha salido al azar */
    linkFavi.href = favicon;

    /** 
     * @brief Si existe la musica en el menu, bajamos el volumen al 30%.
     * Hacemos esto para no dejar sordos a los jugadores nada mas entrar.
     */
    if (musicaMenu) {
        musicaMenu.volume = 0.3;
    }

    /** 
     * @brief Si el boton de jugar existe, le decimos que cuando alguien haga "click":
     * mande al usuario a la pagina donde esta el juego de verdad.
     */
    if (btnJugar) {
        btnJugar.addEventListener("click", function() {
            window.location.href = "paginas/juego.html";
        });
    }

});