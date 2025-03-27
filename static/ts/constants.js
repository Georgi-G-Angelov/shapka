// Constants
const NEW_PLAYER_PREFIX = "new_player:";
const NEW_WORD_PREFIX = "new_word:";
const PLAYER_LEFT_PREFIX = "player_left:";
const PLAYER_KICKED_PREFIX = "player_kicked:";
const START_GAME_MESSAGE = "start_game";
const TIMER_UPDATE_PREFIX = "timer_update:";
const WORD_GUESSED_PREFIX = "word_guessed:";
const UNDO_GUESS_PREFIX = "undo_guess:";
const OUT_OF_WORDS_EVENT = "out_of_words";
const INITIAL_TIMER = 5000;
const NUM_ROUNDS = 3;
const MAX_WORDS_IN_PLAY = 2;
const NEXT_TURN_EVENT = "next_turn";
const NEXT_ROUND_EVENT = "next_round";

const GREEN = "#48f542";
const RED = "#f00202";

const MESSAGE_DURATION_ON_SCREEN = 2000; // milliseconds

const AWAIT_ENDPOINT = "await";
const HOST_ENDPOINT = "host";

// Used to populate local browser storage / cookies
const AUTH_TOKEN_KEY = "authTokenShapka";
const AUTHORIZATION_HEADER = "Authorization";
const PLAYER_NAME_KEY = "shapkaPlayerName";
const GAME_ID_KEY = "shapkaGameId";

var noCacheHeaders = new Headers();
noCacheHeaders.append('pragma', 'no-cache');
noCacheHeaders.append('cache-control', 'no-cache');

var authNoCacheHeaders = new Headers(noCacheHeaders);
authNoCacheHeaders.append(AUTHORIZATION_HEADER, localStorage.getItem(AUTH_TOKEN_KEY));

// Globals
let messageElementTimeout = undefined;