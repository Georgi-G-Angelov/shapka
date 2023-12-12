var currentLocation = window.location.href;

var hostURL = currentLocation.substring(0, currentLocation.indexOf('/', 8));

var name = currentLocation.substring(currentLocation.lastIndexOf('/') + 1);

var locNoName = currentLocation.substring(0, currentLocation.lastIndexOf('/'));
var gameId = locNoName.substring(locNoName.lastIndexOf('/')+1);

console.log(name)
console.log(hostURL)
console.log(gameId)

function fill_all() {
    fill_game_id();
    fill_players();

    subscribe(hostURL + "/newplayers/" + gameId);
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

// Subscribe to the event source at `uri` with exponential backoff reconnect.
function subscribe(uri) {
    var retryTime = 1;
  
    function connect(uri) {
      const events = new EventSource(uri);
  
      events.addEventListener("message", (ev) => {
        var newPlayer = ev.data.replaceAll("\"", "");

        var ul = document.getElementById("players");
        var li = document.createElement("li");
        li.appendChild(document.createTextNode(newPlayer));
        ul.appendChild(li);

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


    fetch(hostURL + "/add_word/" + gameId + "/" + name + "/" + word, {
        method: "GET",
        })
        .then(response => response.text())
        .then(data => {
            console.log("data is: " + data);
            
            document.getElementById("message").textContent = data;
        });
}