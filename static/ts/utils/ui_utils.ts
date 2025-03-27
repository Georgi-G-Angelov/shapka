// UI utils
// -----------------------------------------------------------------------------------------------------------------------------

import { kickPlayer } from "../await_and_host";
import { gameState } from "../game";
import { getEndpoint, getGameId, getHostUrl, getPlayerName } from "./url_utils";

export function showNextRoundButton() {
    if (gameState.round < 3) {
        if (getPlayerName() == gameState.turn_player) {
            document.getElementById("nextRound")!.style.display = "block";
        }
    } else {
        document.getElementById("showResults")!.style.display = "block";
    }
}

export function hideTimerAndFetchWordButtons() {
    document.getElementById("toggleTimer")!.style.display = "none";
    document.getElementById("fetchWord")!.style.display = "none";
    document.getElementById("undoLastGuess")!.style.display = "none";
}

export function showResults() {
    window.location.href = getHostUrl() + "/results/" + getGameId() + '/' + getPlayerName();
}

export function home() {
    window.location.href = getHostUrl();
}

export function toggleTeams() {
    document.getElementById("teamsList")!.classList.toggle("show");
}

export function showError(errorMessage: string) {
    showMessageElement(errorMessage, RED);
}

export function showMessage(message: string) {
    showMessageElement(message, GREEN);
}

export function showMessageElement(message: string, borderColor: string) {
    let messageElement = document.getElementById("message")!;
    messageElement.textContent = message;
    messageElement.style.top = "30px";
    messageElement.style.borderColor = borderColor;

    clearTimeout(messageElementTimeout);
    messageElementTimeout = setTimeout(hideMessageElement, MESSAGE_DURATION_ON_SCREEN);
}

export function hideMessageElement() {
    let messageElement = document.getElementById("message")!;
    // messageElement.textContent = "";
    messageElement.style.top = "-50px";
}

export function setConnectedStatus(status: boolean) {
    // STATE.connected = status;
    let statusDiv = document.getElementById("status")!;
    statusDiv.className = (status) ? "connected" : "reconnecting";
    let statusMessageDiv = document.getElementById("statusMessage")!;
    statusMessageDiv.textContent = (status) ? "connected" : "reconnecting";
}

export function updateWordsLeftInRound(wordsLeftInRound: number, totalNumWords: number) {
    document.getElementById("wordsLeftInRound")!.innerHTML = "Words left: " + wordsLeftInRound + "/" + totalNumWords;
}

// On the home page, check local storage, and if the player has an active (in game or in await stage) game, allow them to go there
export function checkActiveGameExists() {
    let playerName = localStorage.getItem(PLAYER_NAME_KEY) ?? "";
    let gameId = localStorage.getItem(GAME_ID_KEY) ?? "";

    if (gameId == undefined || gameId == "" || playerName == undefined || playerName == "") {
        return;
    }

    let responseOk: boolean;
    fetch(getHostUrl() + "/is_in_game/" + gameId + '/' + playerName, {
        method: "GET",
        headers: authNoCacheHeaders
    })
    .then(function(response) {
        responseOk = response.ok;
        return response;
    })
    .then(response => response.text())
    .then(data => {
        if (responseOk) {
            data = JSON.parse(data);
            let parsedData = JSON.parse(data);
            let isGameActive = parsedData.isGameActive;
            let isHost = parsedData.isHost;
            console.log(isGameActive);
            console.log(isHost);

            let activeGameBox = document.getElementById("activeGameBox")!;

            // Add a paragraph to say we have an active game
            let h1 = document.createElement("h1");
            let text = document.createTextNode("You have an active game " + gameId);
            h1.appendChild(text);

            activeGameBox.appendChild(h1);

            // Add button to transfer them to the game
            let buttonBox = document.createElement("div");
            buttonBox.classList.add("button-box");
            let button = document.createElement("button");
            buttonBox.appendChild(button);
            button.innerHTML = "Go to game";
            button.addEventListener("click", function() { goToGame(gameId, playerName, isGameActive, isHost) });

            activeGameBox.appendChild(buttonBox);

            // Add the auth header from local storage to the cookies in case the user closed the browser...
            document.cookie = AUTHORIZATION_HEADER + "=" + localStorage.getItem(AUTH_TOKEN_KEY);
        }
    });
}

export function goToGame(gameId: string, playerName: string, isGameActive: string, isHost: string) {
    window.location.href = getHostUrl() + "/game/" + gameId + '/' + playerName;

    if (isGameActive == "true") {
        window.location.href = getHostUrl() + "/game/" + gameId + '/' + playerName;
    } else {
        if (isHost == "true") {
            window.location.href = getHostUrl() + "/host/" + gameId + '/' + playerName;
        } else {
            window.location.href = getHostUrl() + "/await/" + gameId + '/' + playerName;
        }
    }
}

export function addPlayerToUI(player: string) {

    var ul = document.getElementById("players")!;
    var li = document.createElement("li");
    li.classList.add('playerElement');

    let p = document.createElement("p");
    let text = document.createTextNode(player);
    p.appendChild(text);

    li.appendChild(p);

    if (getEndpoint() == "host" && getPlayerName() != player) {
        const myButton = document.createElement('button');
        myButton.textContent = 'X';
        li.appendChild(myButton);
        
        myButton.addEventListener("click", function() { kickPlayer(player) });
    }

    ul.appendChild(li);
}

export function deletePlayerElementFromUI(player: string) {
    let playerElements = document.getElementById("players")!.getElementsByTagName("li");
    for (let i = 0; i < playerElements.length; i++) {

        console.log("innerhtml " + playerElements[i].innerHTML)

        let currentElementWord = playerElements[i].getElementsByTagName("p")[0];
        if (currentElementWord != undefined && currentElementWord.innerHTML == player) {
            document.getElementById("players")!.removeChild(playerElements[i]);
            break;
        }
    }

    let wordInput = document.getElementById("word") as HTMLInputElement;
    wordInput.disabled = false;
    wordInput.value = "";
}