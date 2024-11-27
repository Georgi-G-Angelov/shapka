// Data from URL utils
// -----------------------------------------------------------------------------------------------------------------------------

function getHostUrl() {
    return window.location.protocol + "//" + window.location.host;
}

// Only works if URL ends with /<player-name>
function getPlayerName() {
    let currentLocation = window.location.href;
    let nameInURLFormat = currentLocation.substring(currentLocation.lastIndexOf('/') + 1);
    return decodeURI(nameInURLFormat);
}

// Only works if URL ends with /<game-id>/<player-name>
function getGameId() {
    let currentLocation = window.location.href;
    let locationWithoutPlayerName = currentLocation.substring(0, currentLocation.lastIndexOf('/'));
    return locationWithoutPlayerName.substring(locationWithoutPlayerName.lastIndexOf('/')+1);
}

// Only works if URL ends with <endpoint>/<game-id>/<player-name>
function getEndpoint() {
    let currentLocation = window.location.href;
    let locationWithoutPlayerName = currentLocation.substring(0, currentLocation.lastIndexOf('/'));
    let locationWithoutGameId = locationWithoutPlayerName.substring(0, locationWithoutPlayerName.lastIndexOf('/'));
    return locationWithoutGameId.substring(locationWithoutGameId.lastIndexOf('/')+1);
}