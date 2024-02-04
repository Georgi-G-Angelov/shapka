/*
Example value for game state:
{
    "timer": 60000,
    "turn_player": "az",
    "num_words_guessed_per_team": {},
    "teams": [
        [
            "az",
            "joro"
        ],
        [
            "dimi",
            "pesho"
        ]
    ],
    "teammates": {
        "dimi": "pesho",
        "joro": "az",
        "az": "joro",
        "pesho": "dimi"
    },
    "team_member_to_team_index": {
        "pesho": 1,
        "joro": 0,
        "az": 0,
        "dimi": 1
    },
    "words_guessed": [],
    "words_in_play": [],
    "words_to_guess": [],
    "round": 1,
    "is_turn_active": false,
    "is_round_active": true
}
*/
var gameState;

// Timer variables
var isTimerOn = false; // time on/off flag lol
var timer; // the function on an interval which runs the timer
var timerValueMillis;
var timerValueSeconds;
var timerDeltaSinceLastServerUpdate; // we need to update the server every around 500 millis

var isConnectedToEvents = false;

async function fetchGameState() {
    fetch(getHostUrl() + "/fetch_game_state/" + getGameId(), {
        method: "GET",
    })
        .then(response => response.text())
        .then(data => {
            console.log("data is: " + data);

            gameState = JSON.parse(data);

            console.log(gameState);

            fill_all_game_mode();
        });
}

function fill_all_game_mode() {
    fill_game_id();
    fillTurnPlayerMessage();
    fillTeams();

    // Show timer button and fetch word button
    if (gameState.turn_player == getPlayerName()) {
        document.getElementById("toggleTimer").style.display = "block";
        document.getElementById("fetchWord").style.display = "block";
    } else {
        document.getElementById("toggleTimer").style.display = "none";
        document.getElementById("fetchWord").style.display = "none";
        document.getElementById("nextTurn").style.display = "none";
        document.getElementById("nextRound").style.display = "none";
    }
    setTimerButtonText();

    fillWordsInPlay();

    // Set initial timer values
    timerValueSeconds = gameState.timer / 1000;
    timerValueMillis = gameState.timer;
    document.getElementById("timer").textContent = millisecondsToString(timerValueMillis);
    timerDeltaSinceLastServerUpdate = 0;

    //
    if (!gameState.is_round_active) {
        showNextRoundButton();
        hideTimerAndFetchWordButtons();
    }

    // if (!gameState.is_turn_active) {
    //     showNextTurnButton();
    // }

    if (!isConnectedToEvents) {
        subscribe(getHostUrl() + "/gameevents/" + getGameId());
        isConnectedToEvents = true;
    }
}

function fillTurnPlayerMessage() {
    let currentPlayer = getPlayerName();
    console.log("Checking turn player:")
    console.log("current player is " + currentPlayer);
    console.log("turn player is " + gameState.turn_player);

    if (currentPlayer == gameState.turn_player) {
        document.getElementById("turnPlayer").textContent = currentPlayer + ", it's your turn!";
    } else {
        document.getElementById("turnPlayer").textContent = "It is " + getPossesiveNoun(gameState.turn_player) + " turn!";
    }
}

function fillTeams() {
    gameState.teams.forEach(team => {
        var ul = document.getElementById("teams");
        var li = document.createElement("li");
        li.appendChild(document.createTextNode(team[0] + " and " + team[1]));
        ul.appendChild(li);
    });
}

function fillWordsInPlay() {
    if (getPlayerName() == gameState.turn_player) {
        gameState.words_in_play.forEach(word => {
            addWordInPlay(word);
        });
    }
}

async function startTimer() {
    var currentTime = Date.now();
    isTimerOn = true;
    gameState.is_turn_active = true;
    if (timerValueMillis == INITIAL_TIMER || !anyWordsInPlay()) {
        await fetchWord();
    }

    timer = setInterval(function() {
        if (!isTimerOn) {
            return;
        }
        var newCurrentTime = Date.now();
        var delta = newCurrentTime - currentTime;
        timerValueMillis -= delta;
        currentTime = newCurrentTime;
        document.getElementById("timer").textContent = millisecondsToString(timerValueMillis);

        if (timerValueMillis < 0) {
            isTimerOn = false;
            clearInterval(timer);
            document.getElementById("timer").textContent = millisecondsToString(0);
            gameState.is_turn_active = false;
            updateTimerState(0);
            showNextTurnButton();
        }

        // Update server
        timerDeltaSinceLastServerUpdate += delta;
        if (timerDeltaSinceLastServerUpdate >= 500 && timerValueMillis >= 0) {
            updateTimerState(timerValueMillis);
            timerDeltaSinceLastServerUpdate = 0;
        }
    }, 50); // update about every 50 millis
}

function stopTimer() {
    isTimerOn = false;
    gameState.is_turn_active = false;
    clearInterval(timer);

    if (getPlayerName() == gameState.turn_player) {
        updateTimerState(timerValueMillis);
    }
}

function toggleTimer() {
    if (isTimerOn) {
        stopTimer();
        isTimerOn = false;
    } else {
        startTimer();
        isTimerOn = true;
    }
    setTimerButtonText();
}

function setTimerButtonText() {
    if (isTimerOn) {
        document.getElementById("toggleTimer").textContent = "Stop timer";
    } else {
        document.getElementById("toggleTimer").textContent = "Start timer";
    }
}

async function updateTimerState(millis) {
    // Synchronization is hard
    if (millis < 0) {
        millis = 0;
    }

    gameState.timer = millis;

    fetch(getHostUrl() + "/update_timer_state/" + getGameId() + "/" + millis + "/" + gameState.is_turn_active + "/" + gameState.is_round_active + "/" + gameState.round, {
        method: "GET",
    })
    .then(response => response.text())
    .then(data => {
        console.log("timer updated to: " + data);
    });
}

async function fetchWord() {
    if (!isTimerOn) {
        return;
    }

    let responseOk;
    let responseStatus;

    await fetch(getHostUrl() + "/fetch_word/" + getGameId() + "/" + getPlayerName(), {
        method: "GET",
    })
    .then(function(response) {
        responseOk = response.ok;
        responseStatus = response.status;
        return response;
    })
    .then(response => response.text())
    .then(data => {
        if (responseOk) {
            addWordInPlay(data);
        } else if (responseStatus == 400) { // no words left, so round is over
            gameState.is_round_active = false;
            stopTimer();
            showNextRoundButton();
            hideTimerAndFetchWordButtons();
        } else {
            console.log(data);
            console.log(responseStatus);
        }
    });
}

function guessWord(word) {
    if (!isTimerOn) {
        return;
    }

    let responseOk;
    let responseStatus;

    fetch(getHostUrl() + "/guess_word/" + getGameId() + "/" + getPlayerName() + "/" + word, {
        method: "GET",
    })
    .then(function(response) {
        responseOk = response.ok;
        responseStatus = response.status;
        return response;
    })
    .then(response => response.text())
    .then(data => {
        console.log(data);
        if (responseOk) {
            removeWordInPlay(data);
            if (!anyWordsInPlay()) {
                fetchWord();
            }
        } else {
            console.log(data);
            console.log(responseStatus);
        }
    });
}

function addWordInPlay(word) {
    // Get list of words
    var ul = document.getElementById("wordsInPlay");

    // Create new list entry
    var li = document.createElement("li");

    // Add word
    var newWordParagraph = document.createElement("p");
    newWordParagraph.appendChild(document.createTextNode(word));
    li.appendChild(newWordParagraph);

    // Add button which marks word as guessed
    var guessButton = document.createElement("button");
    guessButton.textContent = "Guess word";
    guessButton.onclick = function() { guessWord(word); };
    li.appendChild(guessButton);

    ul.appendChild(li);
}

function removeWordInPlay(word) {
    // Get list of words
    let ul = document.getElementById("wordsInPlay");

    let listEntries = ul.getElementsByTagName("li");
    for (let i = 0; i < listEntries.length; i++) {
        let paragraphElement = listEntries[i].getElementsByTagName("p")[0];
        if (paragraphElement.textContent == word) {
            ul.removeChild(listEntries[i]);
            break;
        }
    }
}

function anyWordsInPlay() {
    return document.getElementById("wordsInPlay").getElementsByTagName("li").length > 0;
}

function showNextTurnButton() {
    document.getElementById("nextTurn").style.display = "block";
}

async function nextTurn() {
    fetch(getHostUrl() + "/next_turn/" + getGameId(), {
        method: "GET",
    })
    .then(function(response) {
        responseOk = response.ok;
        responseStatus = response.status;
        return response;
    })
    .then(response => response.text())
    .then(data => {
        console.log(data);
    });
}

async function nextRound() {
    fetch(getHostUrl() + "/next_round/" + getGameId(), {
        method: "GET",
    })
    .then(function(response) {
        responseOk = response.ok;
        responseStatus = response.status;
        return response;
    })
    .then(response => response.text())
    .then(data => {
        console.log(data);
    });
}

function cleanDOM() {
    document.getElementById("teams").innerHTML = '';
    document.getElementById("wordsInPlay").innerHTML = '';

    document.getElementById("toggleTimer").style.display = "none";
    document.getElementById("fetchWord").style.display = "none";
    document.getElementById("nextTurn").style.display = "none";
    document.getElementById("nextRound").style.display = "none";
}