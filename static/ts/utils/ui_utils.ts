// UI utils
// -----------------------------------------------------------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', function() {
    const darkModeToggle = document.getElementById('dark-mode-toggle')!;
    const currentTheme = localStorage.getItem('theme');

    if (currentTheme) {
        document.body.classList.add(currentTheme);
        if (currentTheme === 'dark-mode') {
            darkModeToggle.textContent = '☀️'; // Sun icon for light mode
        } else {
            darkModeToggle.textContent = '🌙'; // Moon icon for dark mode
        }
    }

    darkModeToggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
        let theme = 'light-mode';
        if (document.body.classList.contains('dark-mode')) {
            theme = 'dark-mode';
            darkModeToggle.textContent = '☀️'; // Sun icon for light mode
        } else {
            darkModeToggle.textContent = '🌙'; // Moon icon for dark mode
        }
        localStorage.setItem('theme', theme);
    });
});

function showNextRoundButton() {
    if (gameState.round < 3) {
        if (getPlayerName() == gameState.turn_player) {
            document.getElementById("nextRound")!.style.display = "block";
        }
    } else {
        document.getElementById("showResults")!.style.display = "block";
    }
}

function hideTimerAndFetchWordButtons() {
    document.getElementById("toggleTimer")!.style.display = "none";
    document.getElementById("fetchWord")!.style.display = "none";
    document.getElementById("undoLastGuess")!.style.display = "none";
}

function showResults() {
    window.location.href = getHostUrl() + "/results/" + getGameId() + '/' + getPlayerName();
}

function home() {
    window.location.href = getHostUrl();
}

function toggleTeams() {
    document.getElementById("teamsList")!.classList.toggle("show");
}

function showError(errorMessage: string) {
    showMessageElement(errorMessage, RED);
}

function showMessage(message: string) {
    showMessageElement(message, GREEN);
}

function showMessageElement(message: string, borderColor: string) {
    let messageElement = document.getElementById("message")!;
    messageElement.textContent = message;
    messageElement.style.top = "30px";
    messageElement.style.borderColor = borderColor;

    clearTimeout(messageElementTimeout);
    messageElementTimeout = setTimeout(hideMessageElement, MESSAGE_DURATION_ON_SCREEN);
}

function hideMessageElement() {
    let messageElement = document.getElementById("message")!;
    // messageElement.textContent = "";
    messageElement.style.top = "-50px";
}

function setConnectedStatus(status: boolean) {
    // STATE.connected = status;
    let statusDiv = document.getElementById("status")!;
    statusDiv.className = (status) ? "connected" : "reconnecting";
    let statusMessageDiv = document.getElementById("statusMessage")!;
    statusMessageDiv.textContent = (status) ? "connected" : "reconnecting";
}

function updateWordsLeftInRound(wordsLeftInRound: number, totalNumWords: number) {
    document.getElementById("wordsLeftInRound")!.innerHTML = "Words left: " + wordsLeftInRound + "/" + totalNumWords;
}

// On the home page, check local storage, and if the player has an active (in game or in await stage) game, allow them to go there
function checkActiveGameExists() {
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

function goToGame(gameId: string, playerName: string, isGameActive: string, isHost: string) {
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

// function addPlayerToUI(player: string) {

//     var ul = document.getElementById("players")!;
//     var li = document.createElement("li");
//     li.classList.add('playerElement');

//     let p = document.createElement("p");
//     let text = document.createTextNode(player);
//     p.appendChild(text);

//     li.appendChild(p);

//     if (getEndpoint() == "host" && getPlayerName() != player) {
//         const myButton = document.createElement('button');
//         myButton.textContent = 'X';
//         li.appendChild(myButton);
        
//         myButton.addEventListener("click", function() { kickPlayer(player) });
//     }

//     ul.appendChild(li);
// }

/*  Build the following:

    <div class="icon-box">
        <span class="profile-icon">👤</span>
        <span class="close-icon">✖</span>
        <span class="profile-name">James</span>
    </div>
*/
function addPlayerToUI(player: string) {

    var playerList = document.getElementById("players")!;
    var div = document.createElement("div");
    div.classList.add('icon-box');

    let span = document.createElement("span");
    span.classList.add('profile-icon');
    let text = document.createTextNode("👤");
    span.appendChild(text);
    div.appendChild(span);

    if (getEndpoint() == "host" && getPlayerName() != player) {
        span = document.createElement('span');
        span.classList.add('close-icon');
        text = document.createTextNode("✖");
        span.appendChild(text);
        div.appendChild(span);
        
        span.addEventListener("click", function() { kickPlayer(player) });
    }

    span = document.createElement("span");
    span.classList.add('profile-name');
    text = document.createTextNode(player);
    span.appendChild(text);
    div.appendChild(span);

    playerList.appendChild(div);
}

// function deletePlayerElementFromUI(player: string) {
//     let playerElements = document.getElementById("players")!.getElementsByTagName("li");
//     for (let i = 0; i < playerElements.length; i++) {

//         console.log("innerhtml " + playerElements[i].innerHTML)

//         let currentElementWord = playerElements[i].getElementsByTagName("p")[0];
//         if (currentElementWord != undefined && currentElementWord.innerHTML == player) {
//             document.getElementById("players")!.removeChild(playerElements[i]);
//             break;
//         }
//     }

//     let wordInput = document.getElementById("word") as HTMLInputElement;
//     wordInput.disabled = false;
//     wordInput.value = "";
// }

function deletePlayerElementFromUI(player: string) {
    let playerElements = document.getElementById("players")!.getElementsByTagName("div");
    for (let i = 0; i < playerElements.length; i++) {

        console.log("innerhtml " + playerElements[i].innerHTML)

        let currentElementWord = playerElements[i].getElementsByClassName("profile-name")[0];
        if (currentElementWord != undefined && currentElementWord.innerHTML == player) {
            document.getElementById("players")!.removeChild(playerElements[i]);
            break;
        }
    }

    let wordInput = document.getElementById("word") as HTMLInputElement;
    wordInput.disabled = false;
    wordInput.value = "";
}

// function addWordElementToUI(word: string) {
//     var ul = document.getElementById("words")!;
//     var li = document.createElement("li");
//     li.classList.add('wordElement');

//     let p = document.createElement("p");
//     let text = document.createTextNode(word);
//     p.appendChild(text);

//     li.appendChild(p);

//     const myButton = document.createElement('button');
//     myButton.textContent = 'X';
//     li.appendChild(myButton);

//     ul.appendChild(li);

//     myButton.addEventListener("click", function() { deleteWord(word) });
// }

// function deleteWordElementFromUI(word: string) {
//     let wordElements = document.getElementById("words")!.getElementsByTagName("li");
//     for (let i = 0; i < wordElements.length; i++) {

//         console.log("innerhtml " + wordElements[i].innerHTML)

//         let currentElementWord = wordElements[i].getElementsByTagName("p")[0];
//         if (currentElementWord != undefined && currentElementWord.innerHTML == word) {
//             document.getElementById("words")!.removeChild(wordElements[i]);
//             break;
//         }
//     }
//     let wordInput = document.getElementById("word") as HTMLInputElement;
//     wordInput.disabled = false;
//     wordInput.value = "";
// }

/*  Build the following:

    <div class="tile">
        <span class="word">anna</span>
        <span class="close-icon">✖</span>
    </div>
*/
function addWordElementToUI(word: string) {
    var wordsDiv = document.getElementById("words")!;
    var div = document.createElement("div");
    div.classList.add('tile');

    let span = document.createElement("span");
    span.classList.add('word');
    let text = document.createTextNode(word);
    span.appendChild(text);
    div.appendChild(span);

    span = document.createElement("span");
    span.classList.add('close-icon');
    text = document.createTextNode("✖");
    span.appendChild(text);
    div.appendChild(span);

    span.addEventListener("click", function() { deleteWord(word) });

    wordsDiv.appendChild(div);
}

function deleteWordElementFromUI(word: string) {
    let wordElements = document.getElementById("words")!.getElementsByClassName("tile");
    for (let i = 0; i < wordElements.length; i++) {

        console.log("innerhtml " + wordElements[i].innerHTML)

        let currentElementWord = wordElements[i].getElementsByClassName("word")[0];
        if (currentElementWord != undefined && currentElementWord.innerHTML == word) {
            document.getElementById("words")!.removeChild(wordElements[i]);
            break;
        }
    }
    let wordInput = document.getElementById("word") as HTMLInputElement;
    wordInput.disabled = false;
    wordInput.value = "";
}