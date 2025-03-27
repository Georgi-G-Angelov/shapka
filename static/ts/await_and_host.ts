function fillAllAwait() {
    fillAll();

    pollForHasGameStarted();
}

function fillAllHost() {
    fillAll();

    pollForHasGameStarted();
}

function pollForHasGameStarted() {
    setInterval(function() {
        fetch(getHostUrl() + "/has_game_started/" + getGameId(), {
            method: "GET",
            headers: authNoCacheHeaders
        })
        .then(response => response.text())
        .then(data => {
            if (data == "true") {
                window.location.href = getHostUrl() + "/game/" + getGameId() + '/' + getPlayerName();
            }
        });
    }, 5000) // every 5 seconds check if game has started
}

function fillAll() {
    fillGameId();
    fillPlayers();
    fillWords();

    subscribe(getHostUrl() + "/gameevents/" + getGameId());

    console.log(getPlayerName());
    console.log(getHostUrl());
    console.log(getGameId());
}

function fillGameId() {
    document.getElementById("gameId")!.textContent = `Game ${getGameId()}`;
}

function fillPlayers() { 
    fetch(getHostUrl() + "/fetch_players/" + getGameId(), {
            method: "GET",
            headers: authNoCacheHeaders
        })
        .then(response => response.text())
        .then(data => {
            console.log("data is: " + data);
            let parsedData = JSON.parse(data);

            // Make sure the host uses the host page and the other players use the await page
            if (getEndpoint() == AWAIT_ENDPOINT && getPlayerName() == parsedData.host) {
                window.location.href = getHostUrl() + "/" + HOST_ENDPOINT +"/" + getGameId() + '/' + getPlayerName();
            } else if (getEndpoint() == HOST_ENDPOINT && getPlayerName() != parsedData.host) {
                window.location.href = getHostUrl() + "/" + AWAIT_ENDPOINT +"/" + getGameId() + '/' + getPlayerName();
            }
            
            parsedData.players.forEach(player => {
                addPlayerToUI(player);
            });
        });
}

function fillWords() { 
    fetch(getHostUrl() + "/fetch_player_words/" + getGameId() + '/' + getPlayerName(), {
            method: "GET",
            headers: authNoCacheHeaders
        })
        .then(response => response.text())
        .then(data => {
            console.log("data is: " + data);
            let parsedData = JSON.parse(data);

            // Make sure the host uses the host page and the other players use the await page
            if (getEndpoint() == AWAIT_ENDPOINT && getPlayerName() == parsedData.host) {
                window.location.href = getHostUrl() + "/" + HOST_ENDPOINT +"/" + getGameId() + '/' + getPlayerName();
            } else if (getEndpoint() == HOST_ENDPOINT && getPlayerName() != parsedData.host) {
                window.location.href = getHostUrl() + "/" + AWAIT_ENDPOINT +"/" + getGameId() + '/' + getPlayerName();
            }
            
            parsedData.words.forEach(word => {
                addWordElementToUI(word)
            });

            // If the player has already entered enough words, disable the input
            let limit = Number(parsedData.limit);
            if (parsedData.words.length >= limit) {
                let wordInput = document.getElementById("word") as HTMLInputElement;
                wordInput.disabled = true;
                wordInput.value = "No more words";
            }
        });
}

function startGame() {
    let responseOk;
    let responseStatus;
    fetch(getHostUrl() + "/start_game/" + getGameId(), {
        method: "GET",
        headers: authNoCacheHeaders
    })
    .then(function(response) {
        responseOk = response.ok;
        responseStatus = response.status;
        return response;
    })
    .then(response => response.text())
    .then(data => {
        if (!responseOk) {
            let errorMessage = data;
            console.log(`Request ended with status ${responseStatus} and error "${errorMessage}"`);
            showError(errorMessage);
        }
    })
    .catch(error => {
        console.log(error);
    });
}

function leaveGame() {
    let responseOk;
    let responseStatus;
    fetch(getHostUrl() + "/leave_game/" + getGameId() + "/" + getPlayerName(), {
        method: "GET",
        headers: authNoCacheHeaders
    })
    .then(function(response) {
        responseOk = response.ok;
        responseStatus = response.status;
        return response;
    })
    .then(response => response.text())
    .then(data => {
        if (!responseOk) {
            let errorMessage = data;
            console.log(`Request ended with status ${responseStatus} and error "${errorMessage}"`);
            showError(errorMessage);
        } else {
            window.location.href = getHostUrl();
        }
    })
    .catch(error => {
        console.log(error);
    });
}

function addWord() {
    var word = (document.getElementById("word") as HTMLInputElement)!.value.trim();
    if (word == "") {
        return;
    }

    if (containsWhitespaceOrPunctuation(word)) {
        document.getElementById("message")!.textContent = word + " contains whitespace or punctuation";
        showError(word + " contains whitespace or punctuation");
        return;
    }

    if (containsDigits(word)) {
        showError(word + " contains digits");
        return;
    }

    let responseOk;
    let responseStatus;
    console.log(localStorage.getItem(AUTH_TOKEN_KEY));
    fetch(getHostUrl() + "/add_word/" + getGameId() + "/" + getPlayerName() + "/" + word, {
            method: "GET",
            headers: authNoCacheHeaders
        })
        .then(function(response) {
            responseOk = response.ok;
            responseStatus = response.status;
            return response;
        })
        .then(response => response.text())
        .then(data => {
            if (responseOk) {
                let parsedData = JSON.parse(data)
                let wordInput = document.getElementById("word") as HTMLInputElement;
                wordInput.value = "";

                addWordElementToUI(word);

                let numWords = document.getElementById("words")!.getElementsByTagName("li").length;
                let limit = Number(parsedData.wordLimit);
                if (numWords >= limit) {
                    wordInput.disabled = true;
                    wordInput.value = "No more words";
                }
            } else {
                showError(data);
            }
            console.log("word added: " + JSON.stringify(data));
        });
}

function deleteWord(word) {
    if (word == "") {
        return;
    }

    let responseOk;
    let responseStatus;
    console.log(localStorage.getItem(AUTH_TOKEN_KEY));
    fetch(getHostUrl() + "/delete_word/" + getGameId() + "/" + getPlayerName() + "/" + word, {
            method: "GET",
            headers: authNoCacheHeaders
        })
        .then(function(response) {
            responseOk = response.ok;
            responseStatus = response.status;
            return response;
        })
        .then(response => response.text())
        .then(data => {
            if (responseOk) {
                let parsedData = JSON.parse(data);
                console.log("Delete: " + JSON.stringify(parsedData));
                deleteWordElementFromUI(parsedData.wordRemoved);
            } else {
                showError(data);
            }
        });
}

function kickPlayer(player) {
    if (player == "") {
        return;
    }

    let responseOk;
    let responseStatus;
    console.log(localStorage.getItem(AUTH_TOKEN_KEY));
    fetch(getHostUrl() + "/kick_player/" + getGameId() + "/" + getPlayerName() + "/" + player, {
            method: "GET",
            headers: authNoCacheHeaders
        })
        .then(function(response) {
            responseOk = response.ok;
            responseStatus = response.status;
            return response;
        })
        .then(response => response.text())
        .then(data => {
            if (responseOk) {
                data = JSON.parse(data);
                console.log("Kicked: " + JSON.stringify(data));
                deletePlayerElementFromUI(player);
            } else {
                showError(data);
            }
        });
}

function addWordElementToUI(word) {
    var ul = document.getElementById("words")!;
    var li = document.createElement("li");
    li.classList.add('wordElement');

    let p = document.createElement("p");
    let text = document.createTextNode(word);
    p.appendChild(text);

    li.appendChild(p);

    const myButton = document.createElement('button');
    myButton.textContent = 'X';
    li.appendChild(myButton);

    ul.appendChild(li);

    myButton.addEventListener("click", function() { deleteWord(word) });
}

function deleteWordElementFromUI(word) {
    let wordElements = document.getElementById("words")!.getElementsByTagName("li");
    for (let i = 0; i < wordElements.length; i++) {

        console.log("innerhtml " + wordElements[i].innerHTML)

        let currentElementWord = wordElements[i].getElementsByTagName("p")[0];
        if (currentElementWord != undefined && currentElementWord.innerHTML == word) {
            document.getElementById("words")!.removeChild(wordElements[i]);
            break;
        }
    }
    let wordInput = document.getElementById("word") as HTMLInputElement;
    wordInput.disabled = false;
    wordInput.value = "";
}