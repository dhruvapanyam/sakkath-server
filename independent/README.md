# Swiss Tournament Manager

A lightweight, browser-based Swiss tournament management system that works entirely in the frontend without requiring a database or server.

## Features

- Create tournaments with customizable number of teams and rounds
- Generate Swiss pairings automatically
- Enter match results and view updated standings
- Save tournament state to a local file and load it later
- Undo previous rounds
- Warning before closing the page with unsaved changes

## How to Use

### Getting Started

1. Open `index.html` in a web browser.
2. Enter a tournament name.
3. Specify the number of teams and rounds.
4. Click "Generate Team Inputs" to create input fields for team names.
5. Fill in team names (or use default names).
6. Click "Create Tournament" to begin.

### Managing a Tournament

#### Fixtures
- View current round fixtures.
- Enter scores for each match and click "Save" for each fixture.
- Once all fixtures are complete, click "Generate Next Round" to progress.

#### Standings
- View current standings in the Standings tab.
- Teams are sorted by points, then by Opponents' Points Total (OPT).

#### Management
- **Save Tournament**: Download the current tournament state as a JSON file.
- **Load Tournament**: Upload a previously saved tournament file.
- **Undo Last Round**: Revert to the state before the current round.

## Technical Details

The system uses the Edmonds-Blossom algorithm to find optimal pairings in the Swiss format, ensuring that:
- Teams don't play against the same opponent twice
- Teams with similar scores are paired together when possible
- When a scoregroup has an odd number of teams, one team is "floated" to the next scoregroup

## Offline Usage

This application works completely offline in the browser. All tournament data is stored in memory and can be saved to a local file for persistence.

## Implementation Notes

- Built with vanilla JavaScript, HTML, and CSS - no frameworks or dependencies required
- Responsive design that works on both desktop and mobile browsers
- Adapted from a larger tournament management system, focusing on just the Swiss pairing logic

## About Swiss Tournament Format

The Swiss tournament format is designed to pair players/teams with similar records against each other while ensuring that no two players/teams meet more than once. It's commonly used in chess, esports, and other competitive events where a round-robin format isn't practical due to the number of participants. 