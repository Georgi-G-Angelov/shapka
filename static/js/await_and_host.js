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
        })
        .then(response => response.text())
        .then(data => {
            console.log("data is: " + data);
            
            // Simulate an HTTP redirect:
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
            document.getElementById("message").textContent = errorMessage;
        }
    })
    .catch(error => {
        console.log(error);
    });
}

function add_word() {
    var word = document.getElementById("word").value.trim();
    if (word == "" || containsWhitespaceOrPunctuation(word)) {
        document.getElementById("message").textContent = word + " contains whitespace or punctuation";
        return;
    }

    fetch(getHostUrl() + "/add_word/" + getGameId() + "/" + getPlayerName() + "/" + word, {
        method: "GET",
        })
        .then(response => response.text())
        .then(data => {
            console.log("data is: " + data);
            
            document.getElementById("message").textContent = data;
        });
}