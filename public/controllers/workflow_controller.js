import cytoscape from 'cytoscape';

const app = require('ui/modules').get('apps/panorama', []);

const node_colors = [
    '#c3b7ac', // created
    '#aca96e', // scheduled
    '#668d3c', // running
    '#007996', // completed
    '#ac7970', // failed
    '#816c5b' // unknown
];

app.factory('workflowGraph', ['$q', function ($q) {

    let cy;

    let workflowGraph = function (workflow) {
        let deferred = $q.defer();

        let elements = [];
        for (let i = 0; i < workflow.jobs.length; i++) {
            let job = workflow.jobs[i];

            elements.push({
                group: 'nodes',
                data: {
                    id: job.job_id,
                    name: job.job_id,
                    type: job.type,
                    faveBgColor: node_colors[job.status]
                }
            });
            for (let j = 0; j < job.parents.length; j++) {
                let parent = job.parents[j];
                elements.push({
                    group: 'edges',
                    data: {
                        id: 'edge_' + parent + '_' + job.job_id,
                        source: parent,
                        target: job.job_id
                    }
                })
            }
        }

        $(function () { // on dom ready

            cy = cytoscape({
                container: $('#cy')[0],

                style: cytoscape.stylesheet()
                    .selector('node')
                    .css({
                        'content': 'data(name)',
                        'background-color': 'data(faveBgColor)',
                        'text-valign': 'center',
                        'color': 'white',
                        'text-wrap': 'wrap',
                        'width': '200',
                        'height': '70',
                        'shape': 'roundrectangle',

                    })
                    .selector('edge')
                    .css({
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier'
                    }),

                layout: {
                    name: 'breadthfirst',
                    directed: true,
                    padding: 0,
                    spacingFactor: 1.05
                },

                elements: elements,

                ready: function () {
                    deferred.resolve(this);

                }
            });

        }); // on dom ready

        return deferred.promise;
    };

    workflowGraph.listeners = {};

    return workflowGraph;
}]);

app.controller('workflow', function ($scope, $http, kbnUrl, $routeParams, workflowGraph, Private, timefilter) {

    $http.get('../api/panorama/get/wf/' + $routeParams.id).then((response) => {
        $scope.workflow = response.data;

        let cy;
        workflowGraph($scope.workflow).then(function (workflowCy) {
            cy = workflowCy;
            $scope.cyLoaded = true;
        });
    });

    timefilter.enableAutoRefreshSelector();
    timefilter.enableTimeRangeSelector();
});