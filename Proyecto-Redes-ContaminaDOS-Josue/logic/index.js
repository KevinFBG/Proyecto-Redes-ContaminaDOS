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
    refreshGame, 
    getRounds 
} from './game.js';
import { toggleAutoRefresh } from './autorefresh.js';

// Exponer las funciones al ámbito global (window)
// Esto es esencial para que los atributos 'onclick' del HTML funcionen.
window.connect = connect;
window.startGame = startGame;
window.createGame = createGame;
window.searchGame = searchGame;
window.joinGame = joinGame;
window.proposeGroup = proposeGroup;
window.voteGroup = voteGroup;
window.sendAction = sendAction;
window.toggleAutoRefresh = toggleAutoRefresh;

// Opcional, solo si quieres forzar accesibilidad externa de estas funciones (aunque 'refreshGame'
// es llamada internamente y 'getRounds' ya se llama dentro de 'refreshGame').
// window.refreshGame = refreshGame;
// window.getRounds = getRounds;