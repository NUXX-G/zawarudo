const favicons = [
    "recursos/imagenes/faviconV1.png",
    "recursos/imagenes/faviconV2.png",
    "recursos/imagenes/faviconV3.png"
    ]

document.addEventListener("DOMContentLoaded", function() {

    var btnJugar = document.getElementById("btn-jugar");
    var musicaMenu = document.getElementById("musica-menu");

    const favicon = favicons[Math.floor(Math.random() * favicons.length)];
    const linkFavi = document.getElementById("favicon");
    linkFavi.href = favicon;

    if (musicaMenu) {
        musicaMenu.volume = 0.3;
    }

    if (btnJugar) {
        btnJugar.addEventListener("click", function() {
            window.location.href = "paginas/juego.html";
        });
    }


});