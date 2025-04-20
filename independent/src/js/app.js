document.addEventListener('DOMContentLoaded', () => {
    const tournamentManager = new TournamentManager();
    
    // DOM Elements - Setup Section
    const setupSection = document.getElementById('setup-section');
    const tournamentNameInput = document.getElementById('tournament-name');
    const numTeamsInput = document.getElementById('num-teams');
    const numRoundsInput = document.getElementById('num-rounds');
    const teamsContainer = document.getElementById('teams-container');
    const generateTeamsBtn = document.getElementById('generate-teams-btn');
    const createTournamentBtn = document.getElementById('create-tournament-btn');
    const startScreenLoadBtn = document.getElementById('start-screen-load-btn');
    const startScreenLoadFile = document.getElementById('start-screen-load-file');
    
    // DOM Elements - Tournament Section
    const tournamentSection = document.getElementById('tournament-section');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const currentRoundDisplay = document.getElementById('current-round');
    const fixturesContainer = document.getElementById('fixtures-container');
    const generateNextRoundBtn = document.getElementById('generate-next-round-btn');
    const standingsBody = document.getElementById('standings-body');
    
    // DOM Elements - Past Rounds
    const roundSelect = document.getElementById('round-select');
    const pastRoundFixturesContainer = document.getElementById('past-round-fixtures-container');
    
    // DOM Elements - Management
    const saveTournamentBtn = document.getElementById('save-tournament-btn');
    const loadTournamentBtn = document.getElementById('load-tournament-btn');
    const loadFileInput = document.getElementById('load-file');
    const undoLastRoundBtn = document.getElementById('undo-last-round-btn');
    
    // DOM Elements - Exit Dialog
    const exitDialog = document.getElementById('exit-dialog');
    const saveAndExitBtn = document.getElementById('save-and-exit-btn');
    const exitWithoutSavingBtn = document.getElementById('exit-without-saving-btn');
    const cancelExitBtn = document.getElementById('cancel-exit-btn');
    
    // Flag to trk if state is saved
    let tournamentModified = false;
    
    // Handle generate team inputs
    generateTeamsBtn.addEventListener('click', () => {
        const numTeams = parseInt(numTeamsInput.value);
        if (isNaN(numTeams) || numTeams < 4) {
            alert('Please enter a valid number of teams (minimum 4)');
            return;
        }
        
        teamsContainer.innerHTML = '';
        
        for (let i = 1; i <= numTeams; i++) {
            const teamInputDiv = document.createElement('div');
            teamInputDiv.className = 'team-input';
            teamInputDiv.innerHTML = `
                <label for="team-${i}">Team ${i}:</label>
                <input type="text" id="team-${i}" placeholder="Team ${i} Name">
            `;
            teamsContainer.appendChild(teamInputDiv);
        }
        
        createTournamentBtn.disabled = false;
    });
    
    // Handle tournament creation
    createTournamentBtn.addEventListener('click', () => {
        const tournamentName = tournamentNameInput.value.trim();
        if (!tournamentName) {
            alert('Please enter a tournament name');
            return;
        }
        
        const numRounds = parseInt(numRoundsInput.value);
        if (isNaN(numRounds) || numRounds < 1) {
            alert('Please enter a valid number of rounds');
            return;
        }
        
        const teamInputs = teamsContainer.querySelectorAll('input');
        const teamNames = [];
        
        teamInputs.forEach(input => {
            const teamName = input.value.trim();
            if (teamName) {
                teamNames.push(teamName);
            } else {
                teamNames.push(input.placeholder); // Use placeholder as fallback
            }
        });
        
        if (teamNames.length < 4) {
            alert('You need at least 4 teams for a Swiss tournament');
            return;
        }
        
        // Create the tournament
        tournamentManager.createTournament(tournamentName, teamNames, numRounds);
        
        // Generate the first round
        tournamentManager.generateNextRound();
        
        // Update the UI
        setupSection.classList.add('hidden');
        tournamentSection.classList.remove('hidden');
        updateTournamentUI();
        
        tournamentModified = true;
    });
    
    // Tab navigation
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Update active button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update active content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
        });
    });
    
    // Generate next round
    generateNextRoundBtn.addEventListener('click', () => {
        if (tournamentManager.generateNextRound()) {
            updateTournamentUI();
            tournamentModified = true;
        } else {
            alert('Cannot generate next round. Maximum rounds reached.');
        }
    });
    
    // Save tournament state
    saveTournamentBtn.addEventListener('click', () => {
        const tournamentData = JSON.stringify(tournamentManager.exportState());
        const blob = new Blob([tournamentData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${tournamentManager.tournamentName.replace(/\s+/g, '_')}_tournament.json`;
        downloadLink.click();
        
        URL.revokeObjectURL(url);
        tournamentModified = false;
    });
    
    // Load tournament button click (start screen)
    startScreenLoadBtn.addEventListener('click', () => {
        startScreenLoadFile.click();
    });
    
    // Handle file selection (start screen)
    startScreenLoadFile.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const state = JSON.parse(e.target.result);
                if (tournamentManager.importState(state)) {
                    setupSection.classList.add('hidden');
                    tournamentSection.classList.remove('hidden');
                    updateTournamentUI();
                    tournamentModified = false;
                } else {
                    alert('Invalid tournament file');
                }
            } catch (error) {
                alert('Error loading tournament file: ' + error.message);
            }
        };
        reader.readAsText(file);
        startScreenLoadFile.value = null; // Reset file input
    });
    
    // Load tournament button click (management tab)
    loadTournamentBtn.addEventListener('click', () => {
        if (tournamentModified) {
            if (!confirm('Loading a tournament will replace the current one. Unsaved changes will be lost. Continue?')) {
                return;
            }
        }
        
        loadFileInput.click();
    });
    
    // Handle file selection (management tab)
    loadFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const state = JSON.parse(e.target.result);
                if (tournamentManager.importState(state)) {
                    setupSection.classList.add('hidden');
                    tournamentSection.classList.remove('hidden');
                    updateTournamentUI();
                    tournamentModified = false;
                } else {
                    alert('Invalid tournament file');
                }
            } catch (error) {
                alert('Error loading tournament file: ' + error.message);
            }
        };
        reader.readAsText(file);
        loadFileInput.value = null; // Reset file input
    });
    
    // Undo last round
    undoLastRoundBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to undo the last round?')) {
            const undoInfo = tournamentManager.undoLastRound();
            if (undoInfo) {
                // Build a detailed confirmation message
                let message = `Round ${undoInfo.round} has been undone.\n\nThe following matches were removed:\n`;
                
                undoInfo.fixtures.forEach(fixture => {
                    const matchStatus = fixture.completed ? 
                        `${fixture.team1Name} ${fixture.team1Score} - ${fixture.team2Score} ${fixture.team2Name}` :
                        `${fixture.team1Name} vs ${fixture.team2Name} (not played)`;
                    message += `- ${matchStatus}\n`;
                });
                
                alert(message);
                updateTournamentUI();
                tournamentModified = true;
            } else {
                alert('Cannot undo. No previous rounds available.');
            }
        }
    });
    
    // Update fixture result
    function handleResultUpdate(fixtureIndex, team1Score, team2Score) {
        if (tournamentManager.updateFixtureResult(fixtureIndex, team1Score, team2Score)) {
            updateStandingsUI();
            
            // Enable next round button if all fixtures are complete
            generateNextRoundBtn.disabled = !tournamentManager.allFixturesComplete() || tournamentManager.isLastRound();
            
            tournamentModified = true;
        }
    }
    
    // Update tournament UI
    function updateTournamentUI() {
        // Update current round display
        currentRoundDisplay.textContent = tournamentManager.currentRound;
        
        // Update fixtures
        updateFixturesUI();
        
        // Update standings
        updateStandingsUI();
        
        // Update past rounds selector
        updatePastRoundSelector();
        
        // Update buttons
        generateNextRoundBtn.disabled = !tournamentManager.allFixturesComplete() || tournamentManager.isLastRound();
        undoLastRoundBtn.disabled = tournamentManager.currentRound <= 1;
    }
    
    // Update fixtures UI
    function updateFixturesUI() {
        fixturesContainer.innerHTML = '';
        
        const currentFixtures = tournamentManager.getCurrentRoundFixtures();
        
        currentFixtures.forEach((fixture, index) => {
            const team1 = tournamentManager.getTeamById(fixture.team1);
            const team2 = tournamentManager.getTeamById(fixture.team2);
            
            const fixtureEl = document.createElement('div');
            fixtureEl.className = 'fixture';
            
            fixtureEl.innerHTML = `
                <div class="team">${team1.name}</div>
                <div class="vs">VS</div>
                <div class="team">${team2.name}</div>
                <div class="result">
                    <input type="number" min="0" class="team1-score" value="${fixture.team1Score !== null ? fixture.team1Score : ''}" ${fixture.completed ? 'disabled' : ''}>
                    <span>:</span>
                    <input type="number" min="0" class="team2-score" value="${fixture.team2Score !== null ? fixture.team2Score : ''}" ${fixture.completed ? 'disabled' : ''}>
                    ${!fixture.completed ? '<button class="save-result">Save</button>' : ''}
                </div>
            `;
            
            // Add event listener to save button
            const saveButton = fixtureEl.querySelector('.save-result');
            if (saveButton) {
                saveButton.addEventListener('click', () => {
                    const team1ScoreInput = fixtureEl.querySelector('.team1-score');
                    const team2ScoreInput = fixtureEl.querySelector('.team2-score');
                    
                    const team1Score = parseInt(team1ScoreInput.value);
                    const team2Score = parseInt(team2ScoreInput.value);
                    
                    if (isNaN(team1Score) || isNaN(team2Score) || team1Score < 0 || team2Score < 0) {
                        alert('Please enter valid scores');
                        return;
                    }
                    
                    // Get the fixture index from all fixtures
                    const fixtureIndex = tournamentManager.fixtures.findIndex(f => 
                        f.round === fixture.round && f.team1 === fixture.team1 && f.team2 === fixture.team2);
                    
                    handleResultUpdate(fixtureIndex, team1Score, team2Score);
                    
                    // Disable inputs and remove save button
                    team1ScoreInput.disabled = true;
                    team2ScoreInput.disabled = true;
                    saveButton.remove();
                });
            }
            
            fixturesContainer.appendChild(fixtureEl);
        });
    }
    
    // Update standings UI
    function updateStandingsUI() {
        standingsBody.innerHTML = '';
        
        tournamentManager.standings.forEach(team => {
            const teamInfo = tournamentManager.getTeamById(team.team_id);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${team.rank}</td>
                <td>${teamInfo.name}</td>
                <td>${team.played}</td>
                <td>${team.won}</td>
                <td>${team.played - team.won - team.lost}</td>
                <td>${team.lost}</td>
                <td>${team.points}</td>
                <td>${team.OPT.toFixed(2)}</td>
            `;
            
            standingsBody.appendChild(row);
        });
    }
    
    // Update past round selector
    function updatePastRoundSelector() {
        roundSelect.innerHTML = '';
        
        // Only add rounds that have been completed
        for (let i = 1; i < tournamentManager.currentRound; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = `Round ${i}`;
            roundSelect.appendChild(option);
        }
        
        // Handle empty state
        if (roundSelect.options.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No completed rounds';
            option.disabled = true;
            option.selected = true;
            roundSelect.appendChild(option);
            
            pastRoundFixturesContainer.innerHTML = '<p class="no-data">No past rounds available. Complete the current round to see results here.</p>';
        } else {
            // Show the fixtures for the first past round by default
            roundSelect.value = roundSelect.options[0].value;
            showPastRoundFixtures(parseInt(roundSelect.value));
        }
    }
    
    // Show past round fixtures
    function showPastRoundFixtures(roundNumber) {
        pastRoundFixturesContainer.innerHTML = '';
        
        if (isNaN(roundNumber)) {
            return;
        }
        
        const roundFixtures = tournamentManager.fixtures.filter(fixture => fixture.round === roundNumber);
        
        roundFixtures.forEach(fixture => {
            const team1 = tournamentManager.getTeamById(fixture.team1);
            const team2 = tournamentManager.getTeamById(fixture.team2);
            
            const fixtureEl = document.createElement('div');
            fixtureEl.className = 'fixture past-fixture';
            
            fixtureEl.innerHTML = `
                <div class="team">${team1.name}</div>
                <div class="vs">VS</div>
                <div class="team">${team2.name}</div>
                <div class="result">
                    <span class="score">${fixture.team1Score}</span>
                    <span>:</span>
                    <span class="score">${fixture.team2Score}</span>
                </div>
            `;
            
            pastRoundFixturesContainer.appendChild(fixtureEl);
        });
    }
    
    // Round select change event
    roundSelect.addEventListener('change', () => {
        if (roundSelect.value) {
            showPastRoundFixtures(parseInt(roundSelect.value));
        }
    });
    
    // Confirm before leaving page
    window.addEventListener('beforeunload', (e) => {
        if (tournamentModified) {
            // Modern browsers require you to set returnValue
            e.preventDefault();
            e.returnValue = '';
            
            // Show the custom exit dialog asynchronously, after beforeunload is handled
            setTimeout(() => {
                showExitDialog();
            }, 0);
            
            return '';
        }
    });
    
    // Show exit dialog
    function showExitDialog() {
        exitDialog.classList.remove('hidden');
    }
    
    // Hide exit dialog
    function hideExitDialog() {
        exitDialog.classList.add('hidden');
    }
    
    // Save and exit
    saveAndExitBtn.addEventListener('click', () => {
        saveTournamentBtn.click();
        hideExitDialog();
        window.close();
    });
    
    // Exit without saving
    exitWithoutSavingBtn.addEventListener('click', () => {
        tournamentModified = false;
        hideExitDialog();
        window.close();
    });
    
    // Cancel exit
    cancelExitBtn.addEventListener('click', () => {
        hideExitDialog();
    });
}); 