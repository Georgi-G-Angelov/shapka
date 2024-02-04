// Constants
const NEW_PLAYER_PREFIX = "new_player:";
const START_GAME_MESSAGE = "start_game";
const TIMER_UPDATE_PREFIX = "timer_update:";
const OUT_OF_WORDS_EVENT = "out_of_words";
const INITIAL_TIMER = 5000;
const NEXT_TURN_EVENT = "next_turn";
const NEXT_ROUND_EVENT = "next_round";

// -----------------------------------------------
// Data from URL utils
function getHostUrl() {
    return window.location.protocol + "//" + window.location.host;
}

// Only works if URL ends with /<player-name>
function getPlayerName() {
    let currentLocation = window.location.href;
    return currentLocation.substring(currentLocation.lastIndexOf('/') + 1);
}

// Only works if URL ends with /<game-id>/<player-name>
function getGameId() {
    let currentLocation = window.location.href;
    let locationWithoutPlayerName = currentLocation.substring(0, currentLocation.lastIndexOf('/'));
    return locationWithoutPlayerName.substring(locationWithoutPlayerName.lastIndexOf('/')+1);
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
                window.location.replace(getHostUrl() + "/game/" + getGameId() + '/' + getPlayerName());
            } else if (message.startsWith(TIMER_UPDATE_PREFIX)) {
                let millis = message.substring(TIMER_UPDATE_PREFIX.length);
                document.getElementById("timer").textContent = millisecondsToString(millis);
            } else if (message == OUT_OF_WORDS_EVENT) { // could potentially never need this
                gameState.is_round_active = false;
                showNextRoundButton();
            } else if (message == NEXT_TURN_EVENT || message == NEXT_ROUND_EVENT) {
                cleanDOM();
                fetchGameState();
            }
        });

        events.addEventListener("open", () => {
            // setConnectedStatus(true);
            console.log(`connected to event stream at ${uri}`);
            retryTime = 1;
        });

        events.addEventListener("error", () => {
            // setConnectedStatus(false);
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
    window.location.replace(getHostUrl() + "/results/" + getGameId() + '/' + getPlayerName());
}