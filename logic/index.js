// logic/index.js
 
import { connect } from './connection.js';
import { 
    startGame, 
    createGame, 
    searchGame, 
    joinGame, 
    proposeGroup, 
    voteGroup, 
    sendAction,
    refreshGame
} from './game.js';
import { toggleAutoRefresh, startAutoRefresh } from './autorefresh.js';
import { restoreSession, server, player, currentGameId, autoOn, updatePlayerDisplay } from './utils.js';

window.connect = connect;
window.startGame = startGame;
window.createGame = createGame;
window.searchGame = searchGame;
window.joinGame = joinGame;
window.proposeGroup = proposeGroup;
window.voteGroup = voteGroup;
window.sendAction = sendAction;
window.toggleAutoRefresh = toggleAutoRefresh;

// Restaurar sesión guardada y ajustar UI
try {
    restoreSession();
    // actualizar inputs y estado visual
    const serverUrlEl = document.getElementById('serverUrl');
    const playerNameEl = document.getElementById('playerName');
    if (serverUrlEl && server) serverUrlEl.value = server;
    if (playerNameEl && player) playerNameEl.value = player;
    if (server) {
        const connStatusEl = document.getElementById('connStatus');
        if (connStatusEl) connStatusEl.textContent = 'Conectado a: ' + server;
        // ocultar la sección de conexión y mostrar la de jugador por defecto
        const connSection = document.querySelector('main > section');
        if (connSection) connSection.style.display = 'none';
        const playerSection = document.getElementById('playerSection');
        if (playerSection) playerSection.style.display = 'block';
    }
    // Si ya había una partida seleccionada, mostrar la pantalla de partida
    if (currentGameId) {
        // ocultar playerSection para evitar que la UI 'vuelva' al lobby
        const playerSection = document.getElementById('playerSection');
        if (playerSection) playerSection.style.display = 'none';

        const gameStatusEl = document.getElementById('gameStatus');
        if (gameStatusEl) gameStatusEl.style.display = 'block';
        const gamesListEl = document.getElementById('gamesList');
        if (gamesListEl) gamesListEl.style.display = 'none';
        // intentar refrescar el estado desde la API
        try { refreshGame(); } catch (e) { /* ignore */ }
    }
    // Si el autorefresh estaba activo, reactivarlo
    if (autoOn) {
        try {
            // actualizar texto del botón si existe
            const arBtn = document.querySelector('#gameStatus button[onclick="toggleAutoRefresh(event)"]');
            if (arBtn) arBtn.textContent = 'Autorefresh: On';
            startAutoRefresh();
        } catch (e) { /* ignore */ }
    }
    updatePlayerDisplay();
} catch (e) { /* ignore restore errors */ }
