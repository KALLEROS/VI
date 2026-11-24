/* =========================================================
   Mapa VI · lo que se guarda en el teléfono
   - Lugares marcados como encontrados (progreso)
   - Favoritos
   - Marcas propias (puntos que pone el usuario)
   - Preferencias (ocultar encontrados)
   Todo vive en localStorage, solo en este teléfono/navegador.
   ========================================================= */
(function () {
  'use strict';

  var CLAVE = 'mapa-vi';
  var VACIO = { encontrados: [], favoritos: [], marcas: [], ocultarEncontrados: false };

  // Lee lo guardado; si no hay nada o está dañado, empieza vacío
  function leer() {
    try {
      var d = JSON.parse(localStorage.getItem(CLAVE) || '{}');
      return {
        encontrados: Array.isArray(d.encontrados) ? d.encontrados : [],
        favoritos: Array.isArray(d.favoritos) ? d.favoritos : [],
        marcas: Array.isArray(d.marcas) ? d.marcas : [],
        ocultarEncontrados: !!d.ocultarEncontrados
      };
    } catch (e) {
      return JSON.parse(JSON.stringify(VACIO));
    }
  }

  var estado = leer();

  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) { /* modo privado: no se guarda */ }
  }

  // Agrega o quita un id de una lista; devuelve si quedó adentro
  function alternar(lista, id) {
    var i = lista.indexOf(id);
    if (i === -1) lista.push(id); else lista.splice(i, 1);
    guardar();
    return i === -1;
  }

  window.MapaVI = window.MapaVI || {};
  window.MapaVI.guardado = {
    esEncontrado: function (id) { return estado.encontrados.indexOf(id) !== -1; },
    alternarEncontrado: function (id) { return alternar(estado.encontrados, id); },
    cuantosEncontrados: function (ids) {
      return ids.filter(function (id) { return estado.encontrados.indexOf(id) !== -1; }).length;
    },

    esFavorito: function (id) { return estado.favoritos.indexOf(id) !== -1; },
    alternarFavorito: function (id) { return alternar(estado.favoritos, id); },
    favoritos: function () { return estado.favoritos.slice(); },

    ocultarEncontrados: function () { return estado.ocultarEncontrados; },
    alternarOcultar: function () { estado.ocultarEncontrados = !estado.ocultarEncontrados; guardar(); return estado.ocultarEncontrados; },

    /* Marcas propias: { id, nombre, x, y } en metros del juego */
    marcas: function () { return estado.marcas.slice(); },
    agregarMarca: function (nombre, x, y) {
      var m = { id: 'marca-' + Date.now().toString(36), nombre: nombre, x: Math.round(x), y: Math.round(y) };
      estado.marcas.push(m);
      guardar();
      return m;
    },
    renombrarMarca: function (id, nombre) {
      estado.marcas.forEach(function (m) { if (m.id === id) m.nombre = nombre; });
      guardar();
    },
    borrarMarca: function (id) {
      estado.marcas = estado.marcas.filter(function (m) { return m.id !== id; });
      estado.favoritos = estado.favoritos.filter(function (f) { return f !== id; });
      guardar();
    },

    // Borra el progreso (encontrados). Favoritos y marcas se quedan.
    reiniciarProgreso: function () { estado.encontrados = []; guardar(); },

    // Para pasar los datos a otro teléfono: texto que se copia y se pega
    exportar: function () { return btoa(unescape(encodeURIComponent(JSON.stringify(estado)))); },
    importar: function (texto) {
      var d = JSON.parse(decodeURIComponent(escape(atob(texto.trim()))));
      localStorage.setItem(CLAVE, JSON.stringify(d));
      estado = leer();
    }
  };
})();
