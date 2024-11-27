// UI utils
// -----------------------------------------------------------------------------------------------------------------------------

function showNextRoundButton() {
    if (gameState.round < 3) {
        if (getPlayerName() == gameState.turn_player) {
            document.getElementById("nextRound").style.display = "block";
        }
    } else {
        document.getElementById("showResults").style.display = "block";
    }
}

function hideTimerAndFetchWordButtons() {
    document.getElementById("toggleTimer").style.display = "none";
    document.getElementById("fetchWord").style.display = "none";
    document.getElementById("undoLastGuess").style.display = "none";
}

function showResults() {
    window.location.href = getHostUrl() + "/results/" + getGameId() + '/' + getPlayerName();
}

function home() {
    window.location.href = getHostUrl();
}

function toggleTeams() {
    document.getElementById("teamsList").classList.toggle("show");
}

function showError(errorMessage) {
    showMessageElement(errorMessage, RED);
}

function showMessage(message) {
    showMessageElement(message, GREEN);
}

function showMessageElement(message, borderColor) {
    let messageElement = document.getElementById("message");
    messageElement.textContent = message;
    messageElement.style.top = "30px";
    messageElement.style.borderColor = borderColor;

    clearTimeout(messageElementTimeout);
    messageElementTimeout = setTimeout(hideMessageElement, MESSAGE_DURATION_ON_SCREEN);
}

function hideMessageElement() {
    let messageElement = document.getElementById("message");
    // messageElement.textContent = "";
    messageElement.style.top = "-50px";
}

function setConnectedStatus(status) {
    // STATE.connected = status;
    let statusDiv = document.getElementById("status");
    statusDiv.className = (status) ? "connected" : "reconnecting";
    let statusMessageDiv = document.getElementById("statusMessage");
    statusMessageDiv.textContent = (status) ? "connected" : "reconnecting";
}

function updateWordsLeftInRound(wordsLeftInRound, totalNumWords) {
    document.getElementById("wordsLeftInRound").innerHTML = "Words left: " + wordsLeftInRound + "/" + totalNumWords;
}

// On the home page, check local storage, and if the player has an active (in game or in await stage) game, allow them to go there
function checkActiveGameExists() {
    let playerName = localStorage.getItem(PLAYER_NAME_KEY);
    let gameId = localStorage.getItem(GAME_ID_KEY);

    if (gameId == undefined || gameId == "" || playerName == undefined || playerName == "") {
        return;
    }

    let responseOk;
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
            let isGameActive = data.isGameActive;
            let isHost = data.isHost;
            console.log(isGameActive);
            console.log(isHost);

            let activeGameBox = document.getElementById("activeGameBox");

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

function goToGame(gameId, playerName, isGameActive, isHost) {
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