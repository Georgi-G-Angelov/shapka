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
    "round": 0,
    "is_turn_active": false
}
*/
var gameState;

// Timer variables
var isTimerOn = false; // time on/off flag lol
var timer; // the function on an interval which runs the timer
var timerValueMillis;
var timerValueSeconds;
var timerDeltaSinceLastServerUpdate; // we need to update the server every around 500 millis

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

    // Show timer button
    if (gameState.turn_player == getPlayerName()) {
        document.getElementById("toggleTimer").style.display = "block";
    }
    setTimerButtonText();

    // Set initial timer values
    timerValueSeconds = 60;
    timerValueMillis = 60 * 1000;
    document.getElementById("timer").textContent = millisecondsToString(timerValueMillis);
    timerDeltaSinceLastServerUpdate = 0;

    subscribe(getHostUrl() + "/gameevents/" + getGameId());
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

function startTimer() {
    var currentTime = Date.now();
    isTimerOn = true;

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
            clearInterval(timer);
            document.getElementById("timer").textContent = millisecondsToString(0);
        }

        // Update server
        timerDeltaSinceLastServerUpdate += delta;
        if (timerDeltaSinceLastServerUpdate >= 500) {
            updateTimerState(timerValueMillis);
            timerDeltaSinceLastServerUpdate = 0;
        }
    }, 50); // update about every 50 millis
}

function stopTimer() {
    isTimerOn = false;
    clearInterval(timer);
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
    fetch(getHostUrl() + "/update_timer_state/" + getGameId() + "/" + millis, {
        method: "GET",
    })
        .then(response => response.text())
        .then(data => {
            console.log("timer updated to: " + data);
        });
}