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
    document.getElementById("gameId").textContent = `Game ${getGameId()}`;
}

function fillPlayers() { 
    fetch(getHostUrl() + "/fetch_players/" + getGameId(), {
            method: "GET",
            headers: authNoCacheHeaders
        })
        .then(response => response.text())
        .then(data => {
            console.log("data is: " + data);
            data = JSON.parse(data);

            // Make sure the host uses the host page and the other players use the await page
            if (getEndpoint() == AWAIT_ENDPOINT && getPlayerName() == data.host) {
                window.location.href = getHostUrl() + "/" + HOST_ENDPOINT +"/" + getGameId() + '/' + getPlayerName();
            } else if (getEndpoint() == HOST_ENDPOINT && getPlayerName() != data.host) {
                window.location.href = getHostUrl() + "/" + AWAIT_ENDPOINT +"/" + getGameId() + '/' + getPlayerName();
            }
            
            data.players.forEach(player => {
                var ul = document.getElementById("players");
                var li = document.createElement("li");
                li.appendChild(document.createTextNode(player));
                ul.appendChild(li);
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
            data = JSON.parse(data);

            // Make sure the host uses the host page and the other players use the await page
            if (getEndpoint() == AWAIT_ENDPOINT && getPlayerName() == data.host) {
                window.location.href = getHostUrl() + "/" + HOST_ENDPOINT +"/" + getGameId() + '/' + getPlayerName();
            } else if (getEndpoint() == HOST_ENDPOINT && getPlayerName() != data.host) {
                window.location.href = getHostUrl() + "/" + AWAIT_ENDPOINT +"/" + getGameId() + '/' + getPlayerName();
            }
            
            data.words.forEach(player => {
                var ul = document.getElementById("words");
                var li = document.createElement("li");
                li.appendChild(document.createTextNode(player));
                ul.appendChild(li);
            });

            // If the player has already entered enough words, disable the input
            let limit = Number(data.limit);
            if (data.words.length >= limit) {
                document.getElementById("word").disabled = true;
                document.getElementById("word").value = "No more words"
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
    var word = document.getElementById("word").value.trim();
    if (word == "") {
        return;
    }

    if (containsWhitespaceOrPunctuation(word)) {
        document.getElementById("message").textContent = word + " contains whitespace or punctuation";
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
                data = JSON.parse(data)
                document.getElementById("word").value = "";
                numWords = document.getElementById("words").getElementsByTagName("li").length;
                limit = Number(data.wordLimit);
                if (numWords >= limit) {
                    document.getElementById("word").disabled = true;
                    document.getElementById("word").value = "No more words"
                }

                var ul = document.getElementById("words");
                var li = document.createElement("li");
                li.classList.add('word_element');
                li.appendChild(document.createTextNode(word));

                const myButton = document.createElement('button');
                myButton.textContent = 'Click me';
                myButton.addEventListener('click', deleteWord);
                // Append myButton to a parent element (e.g., a div or body)
                li.appendChild(myButton);

                ul.appendChild(li);
            } else {
                showError(data);
            }
            console.log("data is: " + data);
        });
}

function deleteWord() {
    var word = document.getElementById("word").value.trim();

    word = "az";

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
                data = JSON.parse(data);

                let wordElements = document.getElementById("words").getElementsByTagName("li");
                for (let i = 0; i < wordElements.length; i++) {
                    if (wordElements[i].innerHTML == data.wordRemoved) {
                        document.getElementById("words").removeChild(wordElements[i]);
                        break;
                    }
                }
                document.getElementById("word").disabled = false;
            } else {
                showError(data);
            }
        });
}