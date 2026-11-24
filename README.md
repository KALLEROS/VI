# Mapa VI · Leonida

Mapa interactivo de Leonida (GTA VI) para el celular: dónde robar, qué saquear, qué autos raros o de regalo hay y dónde están los strip clubs. Cada punto trae su fuente. Lo que no tiene fuente o ubicación exacta queda marcado **[PENDIENTE]** y no se dibuja en el mapa.

No es una tienda ni un catálogo: no incluye ropa ni cosas que solo se compran.

## Cómo se usa

- **Mapa:** pellizca o usa **+ / −** para el zoom, arrastra para moverte. **⤢** vuelve a la vista completa.
- **3D:** inclina el mapa como en el juego.
- **Filtros:** los botones de colores de arriba encienden o apagan cada categoría.
- **Lista:** todos los lugares por categoría, con buscador. Toca uno y el mapa te lleva ahí.
- **Trucos:** códigos, controles y consejos, cada uno con su fuente.

## Instalar en el iPhone

1. Abre la página en **Safari**.
2. Toca **Compartir** → **Añadir a pantalla de inicio**.
3. Ábrela desde el icono: se ve a pantalla completa, sin la barra del navegador.
4. Ábrela una vez con internet. Después funciona sin conexión (el mapa de lejos se guarda completo; los acercamientos se guardan a medida que los ves).

## Archivos

| Archivo | Qué es |
|---|---|
| `index.html` | La página |
| `css/estilos.css` | Diseño |
| `js/app.js` | Mapa, filtros, ficha, lista, trucos y vista 3D |
| `data/locations.json` | Ubicaciones y pendientes (con fuente y verificado sí/no) |
| `data/trucos.json` | Trucos e información técnica |
| `tiles/` | Mapa base en teselas (zoom 0 a 5) |
| `sw.js` | Modo sin conexión |
| `manifest.webmanifest`, `icons/` | Para instalarla como app |
| `vendor/leaflet/` | Librería de mapas Leaflet 1.9.4 (licencia BSD-2) |

## Datos

- Coordenadas `x` / `y` en metros del juego, con el mismo sistema que [gtadb.org](https://gtadb.org) (x crece al este, y al norte).
- **verificado = sí**: al menos dos guías independientes coinciden y gtadb.org tiene el lugar con nombre.
- **verificado = no**: una sola fuente, fuentes que no coinciden, o una sucursal de una marca que las guías dan como robable sin nombrar esa sucursal.
- No se encontraron hilos de Reddit ni publicaciones oficiales de Rockstar con estas ubicaciones; las fuentes son guías publicadas entre el 18 y el 23 de noviembre de 2026.

## Créditos

- **Mapa base:** [gtadb.org](https://gtadb.org) y el GTA VI Mapping Project, mapa trazado a mano por la comunidad, dominio público según su [FAQ](https://faq.gtadb.org). No es un mapa oficial.
- **Librería:** [Leaflet](https://leafletjs.com).
- GTA VI, Leonida y los nombres del juego son de Rockstar Games. Este proyecto no está afiliado a Rockstar.
