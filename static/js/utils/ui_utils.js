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