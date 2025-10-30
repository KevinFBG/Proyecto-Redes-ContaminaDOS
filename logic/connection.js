// logic/connection.js

import { setServer, updatePlayerDisplay, logConsole } from './utils.js';

/* ---------- Connection ---------- */
export function connect() {
    // Tomar el valor del input o usar el valor por defecto
    const serverInput = document.getElementById("serverUrl").value.trim() ||
                        "https://contaminados.akamai.meseguercr.com"; 

    if (!serverInput) return alert("Ingrese la URL del servidor.");
    
    // Almacena el servidor en la variable de estado global
    setServer(serverInput);
    
    document.getElementById("connStatus").textContent = "Conectado a: " + serverInput;
    
    // Ocultar sección de conexión y mostrar la de jugador
    document.querySelector("section").style.display = "none"; 
    document.getElementById("playerSection").style.display = "block";
    document.getElementById("gamesList").style.display = "none";
    
    logConsole("Conectado a " + serverInput);
    updatePlayerDisplay();
}