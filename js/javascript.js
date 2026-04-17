document.addEventListener("DOMContentLoaded", function() {

    var btnJugar = document.getElementById("btn-jugar");
    var musicaMenu = document.getElementById("musica-menu");

    if (musicaMenu) {
        musicaMenu.volume = 0.3;
    }

    if (btnJugar) {
        btnJugar.addEventListener("click", function() {
            window.location.href = "paginas/juego.html";
        });
    }

});