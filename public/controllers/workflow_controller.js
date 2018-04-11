import cytoscape from 'cytoscape';
import 'ui/visualize';
import {VisProvider} from 'ui/vis';
import {getVisualizeLoader} from 'ui/visualize/loader';

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

    $('.itt').popup();

    let workflowGraph = function (workflow) {
        let deferred = $q.defer();

        let elements = [];
        for (let i = 0; i < workflow.jobs.length; i++) {
            let job = workflow.jobs[i];

            elements.push({
                group: 'nodes',
                data: {
                    id: job.job_id,
                    wf_id: workflow.wf_id,
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

            cy.on('tap', 'node', function (event) {
                let node = event.target;
                angular.element(document.getElementById('wf-panel')).scope().GetMonitorDJobInfo(node.data());
            });

        }); // on dom ready

        return deferred.promise;
    };

    workflowGraph.listeners = {};

    return workflowGraph;
}]);

app.controller('workflow', function ($scope, $http, kbnUrl, $routeParams, workflowGraph, Private,
                                     savedVisualizations, serviceSettings, timefilter) {

    $scope.showWfCharacteristics = true;
    $scope.showJobCharacteristics = false;
    $scope.showJobTimeSeries = false;

    $http.get('../api/panorama/get/wf/' + $routeParams.wf_label + '/' + $routeParams.wf_id).then((response) => {
        $scope.workflow = response.data;
        $scope.showWfCharacteristics = true;

        let cy;
        workflowGraph($scope.workflow).then(function (workflowCy) {
            cy = workflowCy;
            $scope.cyLoaded = true;
        });
    });

    timefilter.enableAutoRefreshSelector();

    $scope.GetMonitorDJobInfo = function ($job) {
        $http.get('../api/panorama/get/job/' + $job['wf_id'] + '/' + $job['id']).then((response) => {
            $scope.job = response.data;
            $scope.showJobCharacteristics = true;
        });
    };

    $scope.GetJobTimeSeries = function ($job_id, $wf_id) {
        $http.get('../api/panorama/get/job/series/' + $wf_id + '/' + $job_id).then((response) => {
            $scope.job_series = response.data;

            let stime_series = [{x: 0, y: 0}];
            let utime_series = [{x: 0, y: 0}];

            for (let i = 0, len = $scope.job_series.records.length; i < len; i++) {
                stime_series.push({
                    x: $scope.job_series.records[i].step,
                    y: $scope.job_series.records[i].stime,
                });
                utime_series.push({
                    x: $scope.job_series.records[i].step,
                    y: $scope.job_series.records[i].utime,
                });
            }

            $scope.myVisData = {
                'label': 'My Label',
                'xAxisLabel': 'Job Makespan (s)',
                'yAxisLabel': 'Time (s)',
                'series': [
                    {
                        'label': 'stime',
                        'values': stime_series
                    },
                    {
                        'label': 'utime',
                        'values': utime_series
                    }
                ]
            };

            let Vis = Private(VisProvider);
            $scope.myVis = new Vis('.panorama*', {
                type: 'area',
                mode: 'stacked',
            });

            $scope.showJobTimeSeries = true;
        });
    };
});
