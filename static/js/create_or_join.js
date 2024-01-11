function create_redirect() {
    window.location.replace(getHostUrl() + "/create");
}

function create_game() {
    var name = document.getElementById("name").value;

    fetch(getHostUrl() + "/create_game/" + name, {
    method: "GET",
    })
    .then(response => response.text())
    .then(data => {
        window.location.replace(getHostUrl() + "/host/" + data + '/' + name);
    });
}

function join_redirect() {
    window.location.replace(getHostUrl() + "/join");
}

function join_game() {
    var name = document.getElementById("name").value;
    var gameId = document.getElementById("game_id").value;

    fetch(getHostUrl() + "/join_game/" + gameId + "/" + name, {
    method: "GET",
    })
    .then(response => response.text())
    .then(data => {
        // Simulate an HTTP redirect:
        console.log(data)
        if (!isNaN(data)) {
            window.location.replace(getHostUrl() + "/await/" + gameId + '/' + name);
        }
    });
}