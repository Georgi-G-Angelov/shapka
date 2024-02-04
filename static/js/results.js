function fillResults() {
    fill_game_id();

    let teamsList = document.getElementById("teams");

    for (let i = 0; i < gameState.teams.length; i++) {
        let team = gameState.teams[i];
        let perTeamElement = document.createElement("li");

        let teamHeader = document.createElement("h3");
        teamHeader.appendChild(document.createTextNode(team[0] + " and " + team[1]));
        perTeamElement.appendChild(teamHeader);

        let resultsPerRound = document.createElement("ul");
        let totalWords = 0;
        for (let j = 1; j <= NUM_ROUNDS; j++) {
            totalWords += gameState.words_guessed_per_team_per_round[j][0].length;
            let numWordsForRoundMessage = `Round ${j}: ${gameState.words_guessed_per_team_per_round[j][0].length} words`; // [j][0] because javascript
            let perRoundHeader = document.createElement("h4");
            perRoundHeader.appendChild(document.createTextNode(numWordsForRoundMessage))
            resultsPerRound.appendChild(perRoundHeader);

            let perRoundWords = document.createElement("p");
            perRoundWords.appendChild(document.createTextNode(gameState.words_guessed_per_team_per_round[j][0].join(", ")));
            resultsPerRound.appendChild(perRoundWords);
        }

        let totalWordsHeader = document.createElement("h3");
        totalWordsHeader.appendChild(document.createTextNode(`Total words guessed: ${totalWords}`));
        perTeamElement.appendChild(totalWordsHeader);
        perTeamElement.appendChild(resultsPerRound);

        teamsList.appendChild(perTeamElement);
    };

}