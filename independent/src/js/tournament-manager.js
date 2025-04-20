class TournamentManager {
    constructor() {
        this.swissDrawManager = new SwissDrawManager();
        this.resetTournament();
    }

    resetTournament() {
        this.tournamentName = '';
        this.teams = [];
        this.numRounds = 0;
        this.currentRound = 0;
        this.fixtures = [];
        this.results = [];
        this.teamHistory = {};
        this.standings = [];
        this.history = []; // For undo functionality
    }

    createTournament(name, teams, numRounds) {
        this.resetTournament();
        this.tournamentName = name;
        this.teams = teams.map((team, index) => ({ id: index + 1, name: team }));
        this.numRounds = numRounds;
        
        // Initialize team history (opponents faced)
        this.teams.forEach(team => {
            this.teamHistory[team.id] = [];
        });
        
        // Initialize standings
        this.updateStandings();
        
        // Save initial state to history
        this.saveStateToHistory();
        
        return true;
    }

    generateNextRound() {
        // Don't proceed if we've reached the maximum number of rounds
        if (this.currentRound >= this.numRounds) {
            return false;
        }
        
        // Increment current round
        this.currentRound++;
        
        // Generate pairings using the Swiss algorithm
        const pairings = this.swissDrawManager.generateSwissPairings(this.standings, this.teamHistory);
        
        // Create fixtures for this round
        const roundFixtures = pairings.map(pair => ({
            round: this.currentRound,
            team1: pair[0],
            team2: pair[1],
            team1Score: null,
            team2Score: null,
            completed: false
        }));
        
        this.fixtures.push(...roundFixtures);
        
        // Save state to history
        this.saveStateToHistory();
        
        return true;
    }

    getCurrentRoundFixtures() {
        return this.fixtures.filter(fixture => fixture.round === this.currentRound);
    }

    getTeamById(id) {
        return this.teams.find(team => team.id === id);
    }

    updateFixtureResult(fixtureIndex, team1Score, team2Score) {
        const fixture = this.fixtures[fixtureIndex];
        if (!fixture) return false;
        
        fixture.team1Score = team1Score;
        fixture.team2Score = team2Score;
        fixture.completed = true;
        
        // Update team history with this match
        this.teamHistory[fixture.team1].push(fixture.team2);
        this.teamHistory[fixture.team2].push(fixture.team1);
        
        // Update standings
        this.updateStandings();
        
        // Save state to history
        this.saveStateToHistory();
        
        return true;
    }

    updateStandings() {
        // Calculate standings based on match results
        const teamStats = {};
        
        // Initialize stats for all teams
        this.teams.forEach(team => {
            teamStats[team.id] = {
                team_id: team.id,
                rank: 0,
                played: 0,
                won: 0,
                lost: 0,
                points: 0,
                OPT: 0  // Opponents' Points Total
            };
        });
        
        // Update stats based on match results
        this.fixtures.forEach(fixture => {
            if (!fixture.completed) return;
            
            const team1 = teamStats[fixture.team1];
            const team2 = teamStats[fixture.team2];
            
            team1.played++;
            team2.played++;
            
            if (fixture.team1Score > fixture.team2Score) {
                team1.won++;
                team2.lost++;
                team1.points += 2; // 2 points for a win
            } else if (fixture.team1Score < fixture.team2Score) {
                team2.won++;
                team1.lost++;
                team2.points += 2; // 2 points for a win
            } else {
                // Draw
                team1.points += 1;
                team2.points += 1;
            }
        });
        
        // Calculate OPT (Opponents' Points Total)
        Object.keys(this.teamHistory).forEach(teamId => {
            const teamId_num = parseInt(teamId);
            const opponents = this.teamHistory[teamId_num];
            if (opponents.length > 0) {
                teamStats[teamId_num].OPT = opponents.reduce((total, opponentId) => 
                    total + teamStats[opponentId].points, 0) / opponents.length;
            }
        });
        
        // Convert to array and sort by points (then OPT)
        this.standings = Object.values(teamStats).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            return b.OPT - a.OPT;
        });
        
        // Assign ranks
        this.standings.forEach((team, index) => {
            team.rank = index + 1;
        });
        
        return this.standings;
    }

    allFixturesComplete() {
        const currentFixtures = this.getCurrentRoundFixtures();
        return currentFixtures.every(fixture => fixture.completed);
    }

    isLastRound() {
        return this.currentRound >= this.numRounds;
    }

    saveStateToHistory() {
        // Create a deep copy of the current state
        const currentState = {
            teams: JSON.parse(JSON.stringify(this.teams)),
            numRounds: this.numRounds,
            currentRound: this.currentRound,
            fixtures: JSON.parse(JSON.stringify(this.fixtures)),
            teamHistory: JSON.parse(JSON.stringify(this.teamHistory)),
            standings: JSON.parse(JSON.stringify(this.standings))
        };
        
        this.history.push(currentState);
    }

    undoLastRound() {
        // Can't undo if there's no history or we're in the first round
        if (this.history.length <= 1 || this.currentRound === 0) {
            return false;
        }
        
        // Get info about what's being undone
        const undoInfo = {
            round: this.currentRound,
            fixtures: this.getCurrentRoundFixtures().map(fixture => {
                const team1 = this.getTeamById(fixture.team1);
                const team2 = this.getTeamById(fixture.team2);
                return {
                    team1Name: team1.name,
                    team2Name: team2.name,
                    team1Score: fixture.team1Score,
                    team2Score: fixture.team2Score,
                    completed: fixture.completed
                };
            })
        };
        
        // Remove the current state and get the previous one
        this.history.pop();
        const previousState = this.history[this.history.length - 1];
        
        // Restore the previous state
        this.teams = previousState.teams;
        this.numRounds = previousState.numRounds;
        this.currentRound = previousState.currentRound;
        this.fixtures = previousState.fixtures;
        this.teamHistory = previousState.teamHistory;
        this.standings = previousState.standings;
        
        return undoInfo;
    }

    exportState() {
        return {
            tournamentName: this.tournamentName,
            teams: this.teams,
            numRounds: this.numRounds,
            currentRound: this.currentRound,
            fixtures: this.fixtures,
            teamHistory: this.teamHistory,
            standings: this.standings
        };
    }

    importState(state) {
        if (!state || !state.teams || !state.fixtures) {
            return false;
        }
        
        this.tournamentName = state.tournamentName || '';
        this.teams = state.teams;
        this.numRounds = state.numRounds;
        this.currentRound = state.currentRound;
        this.fixtures = state.fixtures;
        this.teamHistory = state.teamHistory;
        this.standings = state.standings;
        
        // Reset and rebuild history
        this.history = [];
        this.saveStateToHistory();
        
        return true;
    }
} 