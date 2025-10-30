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

window.connect = connect;
window.startGame = startGame;
window.createGame = createGame;
window.searchGame = searchGame;
window.joinGame = joinGame;
window.proposeGroup = proposeGroup;
window.voteGroup = voteGroup;
window.sendAction = sendAction;
window.toggleAutoRefresh = toggleAutoRefresh;
