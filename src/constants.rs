pub const MAX_GAME_ID: i32 = 100000;
pub const TIMER_START_VALUE: i32 = 60000;
pub const MAX_WORDS_IN_PLAY: usize = 2;
pub const MIN_WORDS_PER_PLAYER: usize = 4;
pub const MAX_WORDS_PER_PLAYER: usize = 7;
pub const NUM_ROUNDS: i32 = 3;

pub const NEW_PLAYER_EVENT_PREFIX: &str = "new_player:";
pub const NEW_WORD_EVENT_PREFIX: &str = "new_word:";
pub const WORD_REMOVED_EVENT_PREFIX: &str = "word_removed:";
pub const PLAYER_LEFT_EVENT_PREFIX: &str = "player_left:";
pub const TIMER_UPDATE_EVENT_PREFIX: &str = "timer_update:";
pub const WORD_GUESSED_EVENT_PREFIX: &str = "word_guessed:";
pub const UNDO_GUESS_EVENT_PREFIX: &str = "undo_guess:";
pub const OUT_OF_WORDS_EVENT: &str = "out_of_words";
pub const NEXT_TURN_EVENT: &str = "next_turn";
pub const NEXT_ROUND_EVENT: &str = "next_round";
pub const START_GAME_EVENT: &str = "start_game";