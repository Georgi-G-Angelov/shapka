function fillResults() {
    fill_game_id();

    let teamsList = document.getElementById("results");

    // Score calculation
    let teamScores = []
    for (let i = 0; i < gameState.teams.length; i++) {
        let totalWords = 0;
        for (let j = 1; j <= NUM_ROUNDS; j++) {
            if (gameState.words_guessed_per_team_per_round[j][i] != undefined) {
                totalWords += gameState.words_guessed_per_team_per_round[j][i].length;
            }
        }
        teamScores.push(totalWords);
    };

    // Get top 3 teams // doesnt work
    let winnerClasses = ["gold", "silver", "bronze"] // Gold, silver, bronze
    let winners = {};
    let teamScoresCopy = teamScores.slice();
    // teamScores.sort().reverse();
    // teamScores = teamScores.sort();

    function compareDecimals(a, b) {
        if (a === b) 
             return 0;
    
        return a < b ? -1 : 1;
    }

    teamScores.sort(compareDecimals).reverse();

    console.log("team scores copy: " + teamScoresCopy);
    console.log("team scores: " + teamScores);
    let teamsAwarded = 0;
    for(let i = 0; i < teamScores.length; i++) {
        for (let j = 0; j < teamScoresCopy.length; j++) {
            if (teamScoresCopy[j] == teamScores[i]) {
                winners[j] = winnerClasses[i];
                teamsAwarded += 1;
            }
        }
        if (teamsAwarded >= 3) {
            break;
        }
    }
    console.log(winners);


    // Get teams in order of scores
    teamsScores = teamScoresCopy;
    teamScoresWithIndex = [];
    for(let i = 0; i < teamScores.length; i++) {
        teamScoresWithIndex.push([teamScores[i], i]);
    }
    teamScoresWithIndex.sort(function(left, right) {
        return left[0] < right[0] ? -1 : 1;
    });
    let teamsScoresIndices = [];
    teamScores = [];
    for (let i in teamScoresWithIndex) {
        teamScores.push(teamScoresWithIndex[i][0]);
        teamsScoresIndices.push(teamScoresWithIndex[i][1]);
    }

    // build DOM
    // for (let i = 0; i < gameState.teams.length; i++) {
    for (let i = 0; i < teamsScoresIndices.length; i++) {
        let team = gameState.teams[i];
        let perTeamElement = document.createElement("div");
        perTeamElement.classList.add("banner");
        if (i in winners) {
            perTeamElement.classList.add(winners[i]);
        }


        let teamHeader = document.createElement("h3");
        teamHeader.appendChild(document.createTextNode(team[0] + " and " + team[1]));
        teamHeader.classList.add("team");
        perTeamElement.appendChild(teamHeader);

        let resultsPerRound = document.createElement("ul");
        let totalWords = 0;
        for (let j = 1; j <= NUM_ROUNDS; j++) {
            if (gameState.words_guessed_per_team_per_round[j][i] != undefined) {
                totalWords += gameState.words_guessed_per_team_per_round[j][i].length;
                let numWordsForRoundMessage = `Round ${j} (${gameState.words_guessed_per_team_per_round[j][i].length} words): ${gameState.words_guessed_per_team_per_round[j][i].join(", ")}`;
                let perRoundHeader = document.createElement("h4");
                perRoundHeader.appendChild(document.createTextNode(numWordsForRoundMessage))
                resultsPerRound.appendChild(perRoundHeader);
            }
            // let perRoundWords = document.createElement("div");
            // perRoundWords.appendChild(document.createTextNode(gameState.words_guessed_per_team_per_round[j][0].join(", ")));
            // perRoundHeader.appendChild(perRoundWords);
            // // resultsPerRound.appendChild(perRoundWords);
        }

        let totalWordsHeader = document.createElement("h3");
        totalWordsHeader.appendChild(document.createTextNode(totalWords));
        totalWordsHeader.classList.add("score");

        // teamHeader.appendChild(totalWordsHeader);
        perTeamElement.appendChild(totalWordsHeader);
        perTeamElement.appendChild(resultsPerRound);

        teamsList.appendChild(perTeamElement);
    };

}