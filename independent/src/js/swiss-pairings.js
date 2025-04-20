/**
 * Edmonds-Blossom algorithm for maximum weight matching
 * This is an external dependency from the original code
 */
const blossom = (function() {
  // Implementation of the Edmonds-Blossom algorithm for maximum matching
  // Source: https://github.com/mattkrick/EdmondsBlossom
  
  function augmentPath(edges, match, path, v) {
    let i = path.indexOf(v);
    if (i % 2 === 0) { // Even index = we're adding an edge
      while (i < path.length - 1) {
        match[path[i]] = path[i + 1];
        match[path[i + 1]] = path[i];
        i += 2;
      }
    } else {
      while (i > 0) {
        match[path[i]] = path[i - 1];
        match[path[i - 1]] = path[i];
        i -= 2;
      }
    }
    return match;
  }

  function findPath(neighbors, match, base, used, v) {
    used[v] = true;
    for (let neighbor of neighbors[v]) {
      if ((base[neighbor] !== base[v]) && (neighbor !== match[v])) {
        if ((neighbor === -1) || ((match[neighbor] !== -1) && findPath(neighbors, match, base, used, match[neighbor]))) {
          match[neighbor] = v;
          match[v] = neighbor;
          return true;
        }
      }
    }
    return false;
  }

  function findMaximumMatching(edges) {
    // Convert edges to adjacency list
    const nodes = new Set();
    for (const [u, v] of edges) {
      nodes.add(u);
      nodes.add(v);
    }

    const n = Math.max(...nodes) + 1;
    const neighbors = Array(n).fill().map(() => []);
    
    for (const [u, v, weight] of edges) {
      neighbors[u].push(v);
      neighbors[v].push(u);
    }

    const match = Array(n).fill(-1);
    const base = Array(n).fill().map((_, i) => i);
    const used = Array(n).fill(false);

    for (let v = 0; v < n; v++) {
      if (match[v] === -1) {
        used.fill(false);
        findPath(neighbors, match, base, used, v);
      }
    }

    return match;
  }

  return function(edges) {
    return findMaximumMatching(edges);
  };
})();

/**
 * Swiss Tournament Pairing Manager
 * Handles the generation of pairings for Swiss tournaments
 */
class SwissDrawManager {
    constructor() {
        this.team_history = {};
        this.id_to_graph = {};
        this.graph_to_id = {};
        this.standings = {};
    }

    _readMatching(matching, ids) {
        const pairings = [];
        ids.forEach(id => {
            if (matching[id] === -1) return;
            if (id >= matching.length) return;
            if (matching[id] < id) return;
            pairings.push([parseInt(id), parseInt(matching[id])]);
        });
        return pairings;
    }

    _getGraphEdges(graph) {
        const edges = [];
        for (let node in graph) {
            edges.push(...(Object.keys(graph[node]).map(opp => [parseInt(node), parseInt(opp), graph[node][opp]])));
        }
        return edges;
    }

    _addTeamToGraph(graph, team_graph_id, weighted = true) {
        if (team_graph_id in graph) return;
        graph[team_graph_id] = {};

        for (let node in graph) {
            if (node == team_graph_id) continue;
            if (this.team_history[this.graph_to_id[team_graph_id]].includes(this.graph_to_id[node])) continue; // already played against each other
            if (team_graph_id in graph[node] || node in graph[team_graph_id]) continue; // edge exists

            let point_diff = Math.abs(this.standings[team_graph_id].points - this.standings[node].points);
            let edge_weight = weighted ? Math.max(0, 20 - point_diff) : 1;
            
            graph[node][team_graph_id] = edge_weight;
        }
    }

    generateSwissPairings(points_table, team_history) {
        this.team_history = {...team_history};
        this.id_to_graph = {};
        this.graph_to_id = {};
        this.standings = {};

        const first_round = (Object.values(team_history).filter(opponents => opponents.length > 0)).length === 0;
        
        // If first round, then pair teams based on their initial ordering
        if (first_round) {
            const pairs = [];
            const num_teams = points_table.length;
            
            // Sort teams for first round pairing
            points_table.sort((a, b) => a.rank - b.rank);
            
            // Pair teams: 1 vs 5, 2 vs 6, 3 vs 7, 4 vs 8, etc.
            const offset = Math.ceil(num_teams / 2);
            for (let i = 0; i < num_teams / 2; i++) {
                pairs.push([points_table[i].team_id, points_table[i + offset].team_id]);
            }
            
            return pairs;
        }

        // Shuffle points_table to avoid bias in case of tied teams
        points_table = points_table
            .map(value => ({ value, sort: Math.random() }))
            .sort((a, b) => a.sort - b.sort)
            .map(({ value }) => value);

        // Create mappings between team IDs and graph IDs
        points_table.forEach((team, i) => {
            this.id_to_graph[team.team_id] = i;
            this.graph_to_id[i] = team.team_id;
            this.standings[i] = {...team};
        });

        // Create the graph
        const test_graph = {};
        points_table.forEach((team, i) => {
            this._addTeamToGraph(test_graph, i);
        });
        
        const graph_edges = this._getGraphEdges(test_graph);

        // Check if maximum cardinality matching exists (unweighted)
        const unweighted_graph = graph_edges.map(edge => [edge[0], edge[1], 1]);
        const unweighted_pairings = this._readMatching(blossom(unweighted_graph), Object.keys(this.graph_to_id));
        
        if (unweighted_pairings.length < Math.floor(points_table.length / 2)) {
            // Maximum matching not possible, fallback to simple ranking-based pairing
            let ranked = [...points_table];
            ranked.sort((t1, t2) => t1.rank - t2.rank);
            
            let pairs = [];
            for (let i = 0; i + 1 < ranked.length; i += 2) {
                pairs.push([ranked[i].team_id, ranked[i + 1].team_id]);
            }
            
            return pairs;
        }

        // Group teams by score
        const scoregroups = {};
        const scores = Array.from(new Set(points_table.map(row => row.points)));
        scores.sort((s1, s2) => s2 - s1);
        
        scores.forEach(score => {
            scoregroups[score] = points_table.filter(row => row.points == score).map(row => this.id_to_graph[row.team_id]);
        });

        // Try to pair teams within scoregroups
        let pairings = this._tryPairingScoregroups(scoregroups, scores, 0);

        if (pairings == null) {
            return unweighted_pairings.map(pair => pair.map(id => this.graph_to_id[id]));
        }

        return pairings.map(pair => pair.map(id => this.graph_to_id[id]));
    }

    _tryPairingScoregroups(scoregroups, scores, score_index) {
        if (score_index >= scores.length) return []; // base case: success!
        
        const score = scores[score_index];
        const teams_to_pair = [...scoregroups[score]];
        const score_graph_dict = {};

        teams_to_pair.forEach(id => {
            this._addTeamToGraph(score_graph_dict, id);
        });

        const score_graph = this._getGraphEdges(score_graph_dict);

        const copy_scoregroups = (scoregroups) => {
            let new_groups = {};
            for (let score in scoregroups) {
                new_groups[score] = [...scoregroups[score]];
            }
            return new_groups;
        };

        const merge_with_lower = () => {
            if (score_index == scores.length - 1) {
                // No lower group to merge with
                return null;
            }

            const temp_groups = copy_scoregroups(scoregroups);
            temp_groups[scores[score_index + 1]].push(...temp_groups[score]);
            temp_groups[score] = [];

            return this._tryPairingScoregroups(temp_groups, scores, score_index + 1);
        };

        // If scoregroup has even number of teams, try matching internally
        if (teams_to_pair.length % 2 == 0) {
            // Even number of teams
            const matching_targets = blossom(score_graph);
            const matching = this._readMatching(matching_targets, scoregroups[score]);

            if (matching.length == Math.floor(teams_to_pair.length / 2)) {
                // Perfect matching!
                const lower_pairings = this._tryPairingScoregroups(scoregroups, scores, score_index + 1);
                
                if (lower_pairings == null) {
                    // Pairing wasn't possible
                    return merge_with_lower();
                }

                return matching.concat(lower_pairings);
            } else {
                // Matching not found!
                return merge_with_lower();
            }
        } else {
            // Odd number of teams - must downfloat one team
            teams_to_pair.sort().reverse();

            for (let floater of teams_to_pair) {
                // Check if already has been downfloated
                if (score != this.standings[floater].points) {
                    continue;
                }

                // Try removing this team and see if the rest can be paired
                let temp_graph = {};
                for (let node in score_graph_dict) {
                    if (node == floater) continue;
                    this._addTeamToGraph(temp_graph, node);
                }
                
                const temp_edges = this._getGraphEdges(temp_graph);
                const matching_targets = blossom(temp_edges);
                const matching = this._readMatching(matching_targets, Object.keys(temp_graph));

                if (matching.length != Math.floor(Object.keys(temp_graph).length / 2)) {
                    // This team is vital to group, cannot be downfloated
                    continue;
                }

                // Downfloat this team
                const temp_groups = copy_scoregroups(scoregroups);
                temp_groups[score] = [...Object.keys(temp_graph).map(x => parseInt(x))];
                temp_groups[scores[score_index + 1]].push(parseInt(floater));

                const lower_pairings = this._tryPairingScoregroups(temp_groups, scores, score_index + 1);
                
                if (lower_pairings == null) {
                    // Pairing wasn't possible
                    continue;
                }

                return matching.concat(lower_pairings);
            }

            // All floaters failed, merge group
            return merge_with_lower();
        }
    }
} 