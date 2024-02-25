function fill_all() {
    fill_game_id();
    fill_players();

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
            headers: noCacheHeaders
        })
        .then(response => response.text())
        .then(data => {
            console.log("data is: " + data);
            
            if (data.includes(',')) {
                players = data.split(',');
                players.forEach(player => {
                    var ul = document.getElementById("players");
                    var li = document.createElement("li");
                    li.appendChild(document.createTextNode(player));
                    ul.appendChild(li);
                });
            } else {
                var ul = document.getElementById("players");
                var li = document.createElement("li");
                li.appendChild(document.createTextNode(data));
                ul.appendChild(li);
            }
        });
}

function startGame() {
    let responseOk;
    let responseStatus;
    fetch(getHostUrl() + "/start_game/" + getGameId(), {
        method: "GET",
        headers: noCacheHeaders
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
    fetch(getHostUrl() + "/add_word/" + getGameId() + "/" + getPlayerName() + "/" + word, {
            method: "GET",
            headers: noCacheHeaders
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