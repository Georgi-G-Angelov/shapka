function fill_all() {
    authorize();

    fill_game_id();
    fill_players();

    subscribe(getHostUrl() + "/gameevents/" + getGameId());

    console.log(getPlayerName());
    console.log(getHostUrl());
    console.log(getGameId());
}

function authorize() {
    fetch(getHostUrl() + "/authorize/" + getGameId() + "/" + getPlayerName(), {
        method: "GET",
        headers: authNoCacheHeaders
    })
    .then(function(response) {
        if (response.status == 401) {
            window.location.href = getHostUrl() + "/" + "unauthorized";
        } else if (response.status == 403 || response.status == 500) {
            window.location.href = getHostUrl() + "/" + "forbidden";
        }
    })
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
            } else {
                showError(data);
            }
            console.log("data is: " + data);
        });
}