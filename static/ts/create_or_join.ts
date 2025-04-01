function createRedirect() {
    window.location.href = getHostUrl() + "/create";
}

function createGame() {
    let name = (document.getElementById("name") as HTMLInputElement)!.value;
    let wordLimit = (document.getElementById("word-limit") as HTMLInputElement)!.value;

    let responseOk: boolean;
    let responseStatus: number;
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
            let parsedData = JSON.parse(data);
            let playerName = parsedData.name;
            let gameId = parsedData.gameId;
            let authToken = parsedData.authToken;

            localStorage.setItem(AUTH_TOKEN_KEY, authToken);
            localStorage.setItem(GAME_ID_KEY, gameId);
            localStorage.setItem(PLAYER_NAME_KEY, playerName);

            document.cookie = AUTHORIZATION_HEADER + "=" + authToken;

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

function joinRedirect() {
    window.location.href = getHostUrl() + "/join";
}

function joinGame() {
    let name = (document.getElementById("name") as HTMLInputElement)!.value;
    let gameId = (document.getElementById("game_id") as HTMLInputElement)!.value;

    let responseOk: boolean;
    let responseStatus: number;
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

        console.log(data);

        if (responseOk) {
            let parsedData = JSON.parse(data);
            let playerName = parsedData.name;
            let gameId = parsedData.gameId;
            let authToken = parsedData.authToken;

            localStorage.setItem(AUTH_TOKEN_KEY, authToken);
            localStorage.setItem(GAME_ID_KEY, gameId);
            localStorage.setItem(PLAYER_NAME_KEY, playerName);
            
            document.cookie = AUTHORIZATION_HEADER + "=" + authToken;

            window.location.href = getHostUrl() + "/await/" + gameId + '/' + name;
        } else {
            console.log(`Request ended with status ${responseStatus} and error "${data}"`);
            showError(data);
        }
    })
}