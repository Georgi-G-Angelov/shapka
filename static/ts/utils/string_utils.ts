// String utils
// -----------------------------------------------------------------------------------------------------------------------------

function containsWhitespaceOrPunctuation(word) {
    for(let i = 0; i < word.length; i++) {
        let char = word.charAt(i);
        if (isWhiteSpace(char) || isPunct(char)) {
            return true;
        }
    }
    return false;
}

function isWhiteSpace(char) {
    return " \t\n".includes(char);
}
  
function isPunct(char) {
    return ";:.,?!-'\"(){}".includes(char);
}

function containsDigits(word) {
    for(let i = 0; i < word.length; i++) {
        let char = word.charAt(i);
        if (char >= '0' && char <= '9') {
            return true;
        }
    }
    return false;
}

function getPossesiveNoun(name) {
    if (name.toLowerCase().endsWith('s')) {
        return name + "'";
    } else {
        return name + "'s";
    }
}

function millisecondsToString(millis) {
    let minutes = Math.floor(millis / 1000 / 60);
    let seconds = Math.floor(millis / 1000) - minutes * 60;
    millis = millis - seconds * 1000 - minutes * 60 * 1000;
    return integerToTwoDigits(minutes) + ":" + integerToTwoDigits(seconds) + ":" + integerToTwoDigits(millis)
}

function integerToTwoDigits(integer) {
    let string = (integer).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false});
    if (string.length > 2) {
        return string.substring(0,2);
    }
    return string;
}