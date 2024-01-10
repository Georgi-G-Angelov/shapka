var currentLocation = window.location.href;

var hostURL = currentLocation.substring(0, currentLocation.indexOf('/', 8));

var playerName = currentLocation.substring(currentLocation.lastIndexOf('/') + 1);

var locNoName = currentLocation.substring(0, currentLocation.lastIndexOf('/'));
var gameId = locNoName.substring(locNoName.lastIndexOf('/')+1);

console.log(playerName)
console.log(hostURL)
console.log(gameId)

function fill_all() {
    fill_game_id();
    fill_players();

    subscribe(hostURL + "/gameevents/" + gameId);
}

function fill_game_id() {
    document.getElementById("gameId").textContent = gameId;
}

function fill_players() { 
    fetch(hostURL + "/fetch_players/" + gameId, {
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
    fetch(hostURL + "/start_game/" + gameId, {
        method: "GET",
        })
        .then(response => response.text())
        .then(data => {
            console.log("data is: " + data);
        });
}

// Subscribe to the event source at `uri` with exponential backoff reconnect.
function subscribe(uri) {
    var retryTime = 1;
  
    function connect(uri) {
        const events = new EventSource(uri);


        // Figure out where to store these constants
        const newPlayerPrefix = "new_player:";

        events.addEventListener("message", (ev) => {
            var message = ev.data.replaceAll("\"", "");

            if (message.startsWith(newPlayerPrefix)) {
                var newPlayer = message.substring(newPlayerPrefix.length);

                var ul = document.getElementById("players");
                var li = document.createElement("li");
                li.appendChild(document.createTextNode(newPlayer));
                ul.appendChild(li);
            } else if (message.startsWith("start_game")) {
                window.location.replace(hostURL + "/game/" + gameId + '/' + playerName);
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

function add_word() {
    var word = document.getElementById("word").value;
    console.log("Attempting to add: " + word);


    fetch(hostURL + "/add_word/" + gameId + "/" + playerName + "/" + word, {
        method: "GET",
        })
        .then(response => response.text())
        .then(data => {
            console.log("data is: " + data);
            
            document.getElementById("message").textContent = data;
        });
}