// General utils
// -----------------------------------------------------------------------------------------------------------------------------

// Subscribe to the event source at `uri` with exponential backoff reconnect.
function subscribe(uri: string) {
    var retryTime = 1;

    function connect(uri: string) {
        const events = new EventSource(uri);

        // Special handling for any type of event received
        events.addEventListener("message", (ev) => {
            var message = ev.data.replaceAll("\"", "");

            if (message.startsWith(NEW_PLAYER_PREFIX)) {
                var newPlayer = message.substring(NEW_PLAYER_PREFIX.length);

                addPlayerToUI(newPlayer);
            } else if (message.startsWith(START_GAME_MESSAGE)) {
                window.location.href = getHostUrl() + "/game/" + getGameId() + '/' + getPlayerName();
            } else if (message.startsWith(TIMER_UPDATE_PREFIX)) {
                let millis = message.substring(TIMER_UPDATE_PREFIX.length);
                document.getElementById("timer")!.textContent = millisecondsToString(millis);
            } else if (message == OUT_OF_WORDS_EVENT) { // could potentially never need this
                gameState.is_round_active = false;
                showNextRoundButton();
            } else if (message == NEXT_TURN_EVENT || message == NEXT_ROUND_EVENT) {
                cleanDOM();
                fetchGameState();
            } else if (message.startsWith(PLAYER_LEFT_PREFIX)) {
                let player = message.substring(PLAYER_LEFT_PREFIX.length);
                deletePlayerElementFromUI(player);
            } else if (message.startsWith(PLAYER_KICKED_PREFIX)) {
                let player = message.substring(PLAYER_KICKED_PREFIX.length);

                if (getPlayerName() == player) {
                    home();
                }

                deletePlayerElementFromUI(player);
            } else if (message.startsWith(WORD_GUESSED_PREFIX)) {
                decrementWordsLeftInRound();
            } else if (message.startsWith(UNDO_GUESS_PREFIX)) {
                incrementWordsLeftInRound();
            }
        });

        // On connected to event stream
        events.addEventListener("open", () => {
            setConnectedStatus(true);
            console.log(`connected to event stream at ${uri}`);
            retryTime = 1;
        });

        // On error / broken connection
        events.addEventListener("error", () => {
            setConnectedStatus(false);
            events.close();

            let timeout = retryTime;
            retryTime = Math.min(64, retryTime * 2);
            console.log(`connection lost. attempting to reconnect in ${timeout}s`);
            setTimeout(() => connect(uri), (() => timeout * 1000)());
        });
    }
  
    connect(uri);
}