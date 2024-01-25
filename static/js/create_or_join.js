function create_redirect() {
    window.location.replace(getHostUrl() + "/create");
}

function create_game() {
    let name = document.getElementById("name").value;
    let wordLimit = document.getElementById("word-limit").value;

    let responseOk;
    let responseStatus;
    fetch(getHostUrl() + "/create_game/" + name + "/" + wordLimit, {
    method: "GET",
    })
    .then(function(response) {
        responseOk = response.ok;
        responseStatus = response.status;
        return response;
    })
    .then(response => response.text())
    .then(data => {
        if (responseOk) {
            let gameId = data;
            window.location.replace(getHostUrl() + "/host/" + gameId + '/' + name);
        } else {
            let errorMessage = data;
            console.log(`Request ended with status ${responseStatus} and error "${errorMessage}"`);
        }
    })
    .catch(error => {
        console.log(error);
    });
}

function join_redirect() {
    window.location.replace(getHostUrl() + "/join");
}

function join_game() {
    let name = document.getElementById("name").value;
    let gameId = document.getElementById("game_id").value;

    let responseOk;
    let responseStatus;
    fetch(getHostUrl() + "/join_game/" + gameId + "/" + name, {
    method: "GET",
    })
    .then(function(response) {
        responseOk = response.ok;
        responseStatus = response.status;
        return response;
    })
    .then(response => response.text())
    .then(errorMessage => {
        if (responseOk) {
            window.location.replace(getHostUrl() + "/await/" + gameId + '/' + name);
        } else {
            console.log(`Request ended with status ${responseStatus} and error "${errorMessage}"`);
        }
    });
}