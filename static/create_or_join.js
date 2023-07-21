function create_redirect() {
    var currentLocation = window.location.href;
    var hostURL = currentLocation.substring(0, currentLocation.lastIndexOf('/'));

    window.location.replace(hostURL + "/create");
}

function create_game() {
    var name = document.getElementById("name").value;

    var currentLocation = window.location.href;
    var hostURL = currentLocation.substring(0, currentLocation.lastIndexOf('/'));
    console.log(currentLocation);
    console.log(hostURL);

    fetch(hostURL + "/create_game/" + name, {
    method: "GET",
    })
    .then(response => response.text())
    .then(data => {
        // Simulate an HTTP redirect:
        window.location.replace(hostURL + "/host/" + data + '/' + name);
    });
}

function join_redirect() {
    var currentLocation = window.location.href;
    var hostURL = currentLocation.substring(0, currentLocation.lastIndexOf('/'));

    window.location.replace(hostURL + "/join");
}

function join_game() {
    var name = document.getElementById("name").value;
    var gameId = document.getElementById("game_id").value;

    var currentLocation = window.location.href;
    var hostURL = currentLocation.substring(0, currentLocation.lastIndexOf('/'));
    // console.log(currentLocation);
    // console.log(hostURL);

    fetch(hostURL + "/join_game/" + gameId + "/" + name, {
    method: "GET",
    })
    .then(response => response.text())
    .then(data => {
        // Simulate an HTTP redirect:
        console.log(data)
        if (!isNaN(data)) {
            window.location.replace(hostURL + "/await/" + gameId + '/' + name);
        }
    });
}