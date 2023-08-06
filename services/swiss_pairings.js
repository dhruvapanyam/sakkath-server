const blossom = require('edmonds-blossom');

class SwissDrawManager{
    constructor(){
        // required methods:
        /*

            1. Generate fixtures given current round, and history, and current points table

                -- ('O-SAR3', points_table_after_OSAR2, relevant_fixture_history) => <fixtures>



        */
    }

    _readMatching = (matching, ids) => {
        var pairings = [];
        ids.forEach(id => {
            if(matching[id] == -1) return;
            if(id >= matching.length) return;
            if(matching[id] < id) return;
            pairings.push([parseInt(id), parseInt(matching[id])]);
        })
        return pairings;
    }

    _getGraph_Edges = (graph) => {
        let edges = [];
        for(let node in graph){
            edges.push(...(Object.keys(graph[node]).map(opp => [parseInt(node),parseInt(opp),graph[node][opp]])))
        }
        // console.log(edges)
        return edges;
    }

    _addTeamToGraph = (graph, team_graph_id, weighted=true) => {
        // format: graph: {1: set(...), 2: set(...)}
        if(team_graph_id in graph) return;
        graph[team_graph_id] = {}

        for(let node in graph){
            if(node == team_graph_id) continue;
            if(this.team_history[this.graph_to_id[team_graph_id]].includes(this.graph_to_id[node])) continue; // already played against each other
            if(team_graph_id in graph[node] || node in graph[team_graph_id]) continue; // edge exists

            let point_diff = Math.abs(this.standings[team_graph_id].points - this.standings[node].points);
            let OPT_diff = Math.abs(this.standings[team_graph_id].OPT - this.standings[node].OPT);

            let edge_weight = weighted ? Math.max(0,20 - point_diff) : 1;
            // edge_weight = 1;
            // graph[team_graph_id].add(parseInt(node));
            graph[node][team_graph_id] = edge_weight;
        }
    }

    generateSwissPairings = (stage_id, points_table, team_history) => {
        console.log('generateSwissPairings');
        // format:
        //
        // points_table: [{rank,team_id,played,won,lost,points,GD,AOR,AOS,OPT,OMW},]
        // team_history: {team_id: [opp_1,opp_2,...], ...}
        //

        // Steps:
        // 1. Create graph with possible match edges
        // 2. Save rank-to-teamId mapping
        // 3. Create score-groups
        // 4. Recursively make scoregroup pairings and downfloat when required

        this.team_history = {...team_history};
        this.id_to_graph = {};
        this.graph_to_id = {};

        this.standings = {};
        points_table.forEach((team,i) => {
            this.standings[i] = {...team}
        })


        var test_graph = {};

        points_table.forEach((team,i)=>{
            this.id_to_graph[team.team_id] = i;
            this.graph_to_id[i] = team.team_id;

            // if(i==3) return;
            this._addTeamToGraph(test_graph, i);
        })
        var graph_edges = this._getGraph_Edges(test_graph);
        // console.log(test_graph)

        // console.log(graph_edges);

        // Check if maximum cardinality matching exists (unweighted)
        const unweighted_graph = graph_edges.map(edge => [edge[0],edge[1],1]);
        var unweighted_pairings = this._readMatching(blossom(unweighted_graph), Object.keys(this.graph_to_id));
        
        if(unweighted_pairings.length < Math.round(10*points_table.length / 2)/10){
            console.log('Maximum matching not possible!')

            return null;
            // idk what to do then
            // return;
        }

        var scoregroups = {};
        var scores = Array.from(new Set(points_table.map(row => row.points)));
        scores.sort((s1,s2) => s2-s1);
        // console.log(scores);

        scores.forEach((score,i) => {
            scoregroups[score] = points_table.filter(row => row.points==score).map(row => this.id_to_graph[row.team_id]);
        })

        // console.log(scoregroups)

        let pairings = this._tryPairingScoregroups(scoregroups, scores, 0);

        if(pairings == null){
            return unweighted_pairings.map(pair => pair.map(id => this.graph_to_id[id]));
        }

        console.log('swiss:',stage_id,pairings)
        return pairings.map(pair => pair.map(id => this.graph_to_id[id]));


    }

    // function --> generate pairings at the highest level: scores[score_index] scoregroup
    _tryPairingScoregroups = (scoregroups, scores, score_index) => {
        // console.log('trying to pair at group',scores[score_index]);
        if(score_index >= scores.length) return [] // base case: success!
        const score = scores[score_index];

        const teams_to_pair = [...scoregroups[score]];
        var score_graph_dict = {}

        scoregroups[score].forEach(id => {
            this._addTeamToGraph(score_graph_dict, id);
        })

        var score_graph = this._getGraph_Edges(score_graph_dict);

        // console.log(score_graph);

        const copy_scoregroups = (scoregroups) => {
            let new_groups = {};
            for(let score in scoregroups){
                new_groups[score] = [...scoregroups[score]];
            }
            return new_groups;
        }

        const merge_with_lower = () => {
            if(score_index == scores.length-1){
                // no lower gruop to merge with
                return null;
            }

            // console.log(`merging group ${score} with ${scores[score_index+1]}`);

            var temp_groups = copy_scoregroups(scoregroups);
            temp_groups[scores[score_index+1]].push(...temp_groups[score])
            temp_groups[score] = [];

            const merged_pairings = this._tryPairingScoregroups(temp_groups, scores, score_index+1)

            if(merged_pairings == null){
                // console.log(`Merging ${score} down failed!`);
            }
            return merged_pairings;
        }


        // If scoregroup has even number of teams, try matching internally
        // If matching possible, then check if the rest can be matched amongst themselves
        // If not possible, we must merge this group with the next...

        if(teams_to_pair.length % 2 == 0){
            // even #teams
            var matching_targets = blossom(score_graph);
            const matching = this._readMatching(matching_targets, scoregroups[score]);
            // console.log(matching.length,'appearances!');

            if(matching.length == Math.round(teams_to_pair.length/2)){
                // perfect matching!
                var lower_pairings = this._tryPairingScoregroups(scoregroups, scores, score_index+1);
                if(lower_pairings == null){
                    // pairing wasn't possible
                    // console.log('even teams, matching passed, lower failed');
                    return merge_with_lower();
                }

                var result = matching.concat(lower_pairings);
                // console.log(`returning from group ${score}`,result);
                return result;
            }

            else{
                // matching not found!
                // merge with lower
                // console.log('even teams, matching failed');
                return merge_with_lower();
            }
        }
        else{
            // odd #teams
            // must downfloat

            teams_to_pair.sort().reverse();
            // console.log('will attempt to downfloat the following in order:',teams_to_pair);

            for(let floater of teams_to_pair){
                // console.log('checking df candidate:',floater);
                // ------
                // check if already has been downfloated !!
                if(score != this.standings[floater].points){
                    // console.log('Found a double-downfloating-dweeb')
                    continue;
                }

                let temp_graph = {}
                for(let node in score_graph_dict){
                    if(node == floater) continue;
                    this._addTeamToGraph(temp_graph, node);
                }
                // console.log('tempgraph',temp_graph)
                var temp_edges = this._getGraph_Edges(temp_graph)
                // console.log('tempedges',temp_edges)
                var matching_targets = blossom(temp_edges);
                var matching = this._readMatching(matching_targets, Object.keys(temp_graph));

                if(matching.length != Math.round(Object.keys(temp_graph).length/2)){
                    // console.log(floater,'is vital to group, cannot be df\'d');
                    continue;
                }

                // console.log(floater,'is a valid floater')

                var temp_groups = copy_scoregroups(scoregroups);
                temp_groups[score] = [...Object.keys(temp_graph).map(x=>parseInt(x))];
                temp_groups[scores[score_index+1]].push(parseInt(floater));
                // console.log(temp_groups)

                // console.log(`downfloated ${floater} to group ${scores[score_index+1]}!`);

                var lower_pairings = this._tryPairingScoregroups(temp_groups, scores, score_index+1);
                if(lower_pairings == null){
                    // pairing wasn't possible
                    // console.log('odd teams, dfd, matching passed, lower failed');
                    continue;
                }

                var result = matching.concat(lower_pairings);
                // console.log(`returning from group ${score}`,result);
                return result;
            }

            // all floaters failed
            // merge group
            // console.log('all floaters failed');
            return merge_with_lower();

        }

    }
}

module.exports = {
    SwissDrawManager
}
