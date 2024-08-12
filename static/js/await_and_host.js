function fillAllAwait() {
    fill_all();

    pollForHasGameStarted();
}

function fillAllHost() {
    fill_all();

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

function fill_all() {
    fill_game_id();
    fill_players();
    fill_words();

    subscribe(getHostUrl() + "/gameevents/" + getGameId());

    console.log(getPlayerName());
    console.log(getHostUrl());
    console.log(getGameId());
}

function fill_game_id() {
    document.getElementById("gameId").textContent = `Game ${getGameId()}`;
}

function fill_players() { 
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

function fill_words() { 
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

function add_word() {
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
                showMessage(data);
                document.getElementById("word").value = "";
                numWords = document.getElementById("words").getElementsByTagName("li").length;
                if (numWords >= 4) {
                    document.getElementById("word").disabled = true;
                    document.getElementById("word").value = "You can't add any more words"
                }
            } else {
                showError(data);
            }
            console.log("data is: " + data);
        });
}