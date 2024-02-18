function fillResults() {
    fill_game_id();

    let teamsList = document.getElementById("results");

    // Score calculation
    let teamsScores = []
    for (let i = 0; i < gameState.teams.length; i++) {
        let totalWords = 0;
        for (let j = 1; j <= NUM_ROUNDS; j++) {
            if (gameState.words_guessed_per_team_per_round[j][i] != undefined) {
                totalWords += gameState.words_guessed_per_team_per_round[j][i].length;
            }
        }
        teamsScores.push(totalWords);
    };

    // Get top 3 teams
    let winnerClasses = ["gold", "silver", "bronze"] // Gold, silver, bronze
    let winners = {};
    let teamScoresCopy = teamsScores.slice();
    teamsScores.sort().reverse();
    let teamsAwarded = 0;
    for(let i = 0; i < 3; i++) {
        for (let j = 0; j < teamScoresCopy.length; j++) {
            if (teamScoresCopy[j] == teamsScores[i]) {
                winners[j] = winnerClasses[i];
            }
            teamsAwarded += 1;
        }
        if (teamsAwarded >= 3) {
            break;
        }
    }
    console.log(winners);



    for (let i = 0; i < gameState.teams.length; i++) {
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