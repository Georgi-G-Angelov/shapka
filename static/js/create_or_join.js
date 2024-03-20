function create_redirect() {
    window.location.href = getHostUrl() + "/create";
}

function create_game() {
    let name = document.getElementById("name").value;
    let wordLimit = document.getElementById("word-limit").value;

    let responseOk;
    let responseStatus;
    fetch(getHostUrl() + "/create_game/" + name + "/" + wordLimit, {
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
            console.log(data);
            data = JSON.parse(data);
            let gameId = data.gameId;
            let authToken = data.authToken;
            localStorage.setItem(AUTH_TOKEN_KEY, authToken);
            document.cookie = AUTHORIZATION_HEADER + "=" + authToken;
            // TODO: store auth token
            window.location.href = getHostUrl() + "/host/" + gameId + '/' + name;
        } else {
            let errorMessage = data;
            console.log(`Request ended with status ${responseStatus} and error "${errorMessage}"`);
            showError(errorMessage);
        }
    })
    .catch(error => {
        console.log(error);
    });
}

function join_redirect() {
    window.location.href = getHostUrl() + "/join";
}

function join_game() {
    let name = document.getElementById("name").value;
    let gameId = document.getElementById("game_id").value;

    let responseOk;
    let responseStatus;
    fetch(getHostUrl() + "/join_game/" + gameId + "/" + name, {
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
        // TODO: store auth token
        console.log(data);
        data = JSON.parse(data);
        // let gameId = data.gameId;
        let authToken = data.authToken;
        localStorage.setItem(AUTH_TOKEN_KEY, authToken);
        document.cookie = AUTHORIZATION_HEADER + "=" + authToken;
    })
    .then(errorMessage => {
        if (responseOk) {
            window.location.href = getHostUrl() + "/await/" + gameId + '/' + name;
        } else {
            console.log(`Request ended with status ${responseStatus} and error "${errorMessage}"`);
            showError(errorMessage);
        }
    });
}