// Constants
const NEW_PLAYER_PREFIX = "new_player:";
const PLAYER_LEFT_PREFIX = "player_left:";
const START_GAME_MESSAGE = "start_game";
const TIMER_UPDATE_PREFIX = "timer_update:";
const OUT_OF_WORDS_EVENT = "out_of_words";
const INITIAL_TIMER = 5000;
const NUM_ROUNDS = 3;
const NEXT_TURN_EVENT = "next_turn";
const NEXT_ROUND_EVENT = "next_round";

const GREEN = "#48f542";
const RED = "#f00202";

const MESSAGE_DURATION_ON_SCREEN = 2000; // milliseconds

const AWAIT_ENDPOINT = "await";
const HOST_ENDPOINT = "host";

const AUTH_TOKEN_KEY = "authTokenShapka";
const AUTHORIZATION_HEADER = "Authorization";

var noCacheHeaders = new Headers();
noCacheHeaders.append('pragma', 'no-cache');
noCacheHeaders.append('cache-control', 'no-cache');

var authNoCacheHeaders = new Headers(noCacheHeaders);
authNoCacheHeaders.append(AUTHORIZATION_HEADER, localStorage.getItem(AUTH_TOKEN_KEY));

// Globals
let messageElementTimeout = undefined;

// -----------------------------------------------
// Data from URL utils
function getHostUrl() {
    return window.location.protocol + "//" + window.location.host;
}

// Only works if URL ends with /<player-name>
function getPlayerName() {
    let currentLocation = window.location.href;
    let nameInURLFormat = currentLocation.substring(currentLocation.lastIndexOf('/') + 1);
    return decodeURI(nameInURLFormat);
}

// Only works if URL ends with /<game-id>/<player-name>
function getGameId() {
    let currentLocation = window.location.href;
    let locationWithoutPlayerName = currentLocation.substring(0, currentLocation.lastIndexOf('/'));
    return locationWithoutPlayerName.substring(locationWithoutPlayerName.lastIndexOf('/')+1);
}

// Only works if URL ends with <endpoint>/<game-id>/<player-name>
function getEndpoint() {
    let currentLocation = window.location.href;
    let locationWithoutPlayerName = currentLocation.substring(0, currentLocation.lastIndexOf('/'));
    let locationWithoutGameId = locationWithoutPlayerName.substring(0, locationWithoutPlayerName.lastIndexOf('/'));
    return locationWithoutGameId.substring(locationWithoutGameId.lastIndexOf('/')+1);
}

// -----------------------------------------------
// String utils
function containsWhitespaceOrPunctuation(word) {
    for(i = 0; i < word.length; i++) {
        let char = word.charAt(i);
        if (isWhiteSpace(char) || isPunct(char)) {
            return true;
        }
    }
    return false;
}

function isWhiteSpace(char) {
    return " \t\n".includes(char);
}
  
function isPunct(char) {
    return ";:.,?!-'\"(){}".includes(char);
}

function containsDigits(word) {
    for(i = 0; i < word.length; i++) {
        let char = word.charAt(i);
        if (char >= '0' && char <= '9') {
            return true;
        }
    }
    return false;
}

function getPossesiveNoun(name) {
    if (name.toLowerCase().endsWith('s')) {
        return name + "'";
    } else {
        return name + "'s";
    }
}

function millisecondsToString(millis) {
    minutes = Math.floor(millis / 1000 / 60);
    seconds = Math.floor(millis / 1000) - minutes * 60;
    millis = millis - seconds * 1000 - minutes * 60 * 1000;
    return integerToTwoDigits(minutes) + ":" + integerToTwoDigits(seconds) + ":" + integerToTwoDigits(millis)
}

function integerToTwoDigits(integer) {
    let string = (integer).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false});
    if (string.length > 2) {
        return string.substring(0,2);
    }
    return string;
}
//-------------------------------------------------

// Subscribe to the event source at `uri` with exponential backoff reconnect.
function subscribe(uri) {
    var retryTime = 1;
    console.log(uri);
    function connect(uri) {
        const events = new EventSource(uri);

        events.addEventListener("message", (ev) => {
            var message = ev.data.replaceAll("\"", "");

            if (message.startsWith(NEW_PLAYER_PREFIX)) {
                var newPlayer = message.substring(NEW_PLAYER_PREFIX.length);

                var ul = document.getElementById("players");
                var li = document.createElement("li");
                li.appendChild(document.createTextNode(newPlayer));
                ul.appendChild(li);
            } else if (message.startsWith(START_GAME_MESSAGE)) {
                window.location.href = getHostUrl() + "/game/" + getGameId() + '/' + getPlayerName();
            } else if (message.startsWith(TIMER_UPDATE_PREFIX)) {
                let millis = message.substring(TIMER_UPDATE_PREFIX.length);
                document.getElementById("timer").textContent = millisecondsToString(millis);
            } else if (message == OUT_OF_WORDS_EVENT) { // could potentially never need this
                gameState.is_round_active = false;
                showNextRoundButton();
            } else if (message == NEXT_TURN_EVENT || message == NEXT_ROUND_EVENT) {
                cleanDOM();
                fetchGameState();
            } else if (message.startsWith(PLAYER_LEFT_PREFIX)) {
                let player = message.substring(PLAYER_LEFT_PREFIX.length);

                let allListElements = document.getElementsByTagName("li");
                for (i = 0; i < allListElements.length; i++) {
                    if (allListElements[i].textContent == player && allListElements[i].parentNode.id == "players") {
                        allListElements[i].parentNode.removeChild(allListElements[i]);
                        break;
                    }
                }
            }
        });

        events.addEventListener("open", () => {
            setConnectedStatus(true);
            console.log(`connected to event stream at ${uri}`);
            retryTime = 1;
        });

        events.addEventListener("error", () => {
            setConnectedStatus(false);
            events.close();

            let timeout = retryTime;
            retryTime = Math.min(64, retryTime * 2);
            console.log(`connection lost. attempting to reconnect in ${timeout}s`);
            setTimeout(() => connect(uri), (() => timeout * 1000)());
        });
    }
  
    connect(uri);
}

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