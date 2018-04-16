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
    $scope.showJobXfer = false;

    $http.get('../api/panorama/get/wf/' + $routeParams.wf_label + '/' + $routeParams.wf_id).then((response) => {
        $scope.workflow = response.data;
        $scope.showWfCharacteristics = true;

        let cy;
        workflowGraph($scope.workflow).then(function (workflowCy) {
            cy = workflowCy;
            $scope.cyLoaded = true;
        });
        $('.itt').popup();
    });

    timefilter.enableAutoRefreshSelector();

    $scope.GetMonitorDJobInfo = function ($job) {
        $http.get('../api/panorama/get/job/' + $job.wf_id + '/' + $job.id + '/' + $job.type).then((response) => {
            $scope.job = response.data;
            $scope.showJobCharacteristics = true;
            $scope.showJobTimeSeries = false;
            $scope.showJobXfer = false;
        });
        $('.itt').popup();
    };

    $scope.GetJobTimeSeries = function ($job_id, $job_type, $job_duration, $wf_id) {

        if ($job_type === 'compute') {
            // compute jobs
            $http.get('../api/panorama/get/job/series/' + $wf_id + '/' + $job_id + '/' + $job_type).then((response) => {
                $scope.job_series = response.data;

                let stime_series = [{x: 0, y: 0}];
                let utime_series = [{x: 0, y: 0}];
                let rchar_series = [{x: 0, y: 0}];
                let wchar_series = [{x: 0, y: 0}];
                let crchar_series = [{x: 0, y: 0}];
                let cwchar_series = [{x: 0, y: 0}];
                let iowait_series = [{x: 0, y: 0}];
                let thread_series = [{x: 0, y: 0}];
                let cpu_series = [];

                for (let i = 0, len = $scope.job_series.records.length; i < len; i++) {
                    stime_series.push({
                        x: $scope.job_series.records[i].step,
                        y: $scope.job_series.records[i].stime,
                    });
                    utime_series.push({
                        x: $scope.job_series.records[i].step,
                        y: $scope.job_series.records[i].utime,
                    });
                    crchar_series.push({
                        x: $scope.job_series.records[i].step,
                        y: $scope.job_series.records[i].crchar / 1024 / 1024,
                    });
                    cwchar_series.push({
                        x: $scope.job_series.records[i].step,
                        y: $scope.job_series.records[i].cwchar / 1024 / 1024,
                    });
                    iowait_series.push({
                        x: $scope.job_series.records[i].step,
                        y: $scope.job_series.records[i].iowait / $scope.job_series.records[i].threads / 1000000,
                    });
                    thread_series.push({
                        x: $scope.job_series.records[i].step,
                        y: $scope.job_series.records[i].threads,
                    });
                    if (i > 0) {
                        rchar_series.push({
                            x: $scope.job_series.records[i].step,
                            y: $scope.job_series.records[i].rchar / 1024 / 1024,
                        });
                        wchar_series.push({
                            x: $scope.job_series.records[i].step,
                            y: $scope.job_series.records[i].wchar / 1024 / 1024,
                        });
                        cpu_series.push($scope.job_series.records[i].cpu);
                    }
                }

                // cumulative stime and utime
                $scope.cumulTimeData = {
                    xAxisLabel: 'Job Makespan (s)',
                    series: [
                        {
                            label: 'stime',
                            values: stime_series
                        },
                        {
                            label: 'utime',
                            values: utime_series
                        }
                    ]
                };

                let Vis = Private(VisProvider);
                $scope.cumulTime = new Vis('panorama');
                $scope.cumulTime.params.type = 'area';
                $scope.cumulTime.params.mode = 'stacked';
                $scope.cumulTime.params.addTooltip = false;
                $scope.cumulTime.params.legendPosition = 'bottom';
                $scope.cumulTime.params.valueAxes[0].title.text = 'Time (s)';

                // bytes read/written
                $scope.bytesData = {
                    xAxisLabel: 'Steps (s)',
                    series: [
                        {
                            label: 'bytes read',
                            values: rchar_series
                        },
                        {
                            label: 'bytes written',
                            values: wchar_series
                        }
                    ]
                };
                $scope.bytes = new Vis('panorama');
                $scope.bytes.params.type = 'histogram';
                $scope.bytes.params.mode = 'normal';
                $scope.bytes.params.addTooltip = false;
                $scope.bytes.params.legendPosition = 'bottom';
                $scope.bytes.params.valueAxes[0].title.text = 'Megabytes';

                // cumulative bytes read/written
                $scope.cumulBytesData = {
                    xAxisLabel: 'Job Makespan (s)',
                    series: [
                        {
                            label: 'bytes read',
                            values: crchar_series
                        },
                        {
                            label: 'bytes written',
                            values: cwchar_series
                        }
                    ]
                };
                $scope.cumulBytes = new Vis('panorama');
                $scope.cumulBytes.params.type = 'area';
                $scope.cumulBytes.params.mode = 'stacked';
                $scope.cumulBytes.params.addTooltip = false;
                $scope.cumulBytes.params.legendPosition = 'bottom';
                $scope.cumulBytes.params.valueAxes[0].title.text = 'Megabytes';

                // IO wait
                $scope.iowaitData = {
                    xAxisLabel: 'Job Makespan (s)',
                    series: [
                        {
                            label: 'iowait',
                            values: iowait_series
                        }
                    ]
                };
                $scope.iowait = new Vis('panorama');
                $scope.iowait.params.type = 'line';
                $scope.iowait.params.addTooltip = false;
                $scope.iowait.params.addLegend = false;
                $scope.iowait.params.drawLinesBetweenPoints = true;
                $scope.iowait.params.valueAxes[0].title.text = 'Time (s)';

                // threads
                $scope.threadData = {
                    xAxisLabel: 'Job Makespan (s)',
                    series: [
                        {
                            label: 'threads',
                            values: thread_series
                        }
                    ]
                };
                $scope.thread = new Vis('panorama');
                $scope.thread.params.type = 'line';
                $scope.thread.params.addTooltip = false;
                $scope.thread.params.addLegend = false;
                $scope.thread.params.drawLinesBetweenPoints = true;
                $scope.thread.params.valueAxes[0].title.text = 'Time (s)';

                // gauge CPU
                let avg_cpu = 0;
                for (let i = 0, len = cpu_series.length; i < len; i++) {
                    avg_cpu = avg_cpu + cpu_series[i];
                }
                avg_cpu = avg_cpu / cpu_series.length;
                $scope.gaugeData = {
                    'series': [
                        {
                            'label': 'CPU Utilization %',
                            'values': [
                                {
                                    'x': '0.0-100.0',
                                    'y': (avg_cpu * 100).toFixed(0)
                                },
                            ]
                        }
                    ]
                };
                $scope.gauge = new Vis('panorama', {type: 'gauge'});
                $scope.gauge.params.gauge.invertColors = true;
                $scope.gauge.params.addLegend = false;
                $scope.gauge.params.addTooltip = false;
                $scope.gauge.params.gauge.colorsRange = [
                    {from: 0, to: 25},
                    {from: 25, to: 50},
                    {from: 50, to: 75},
                    {from: 75, to: 100}
                ];
                $scope.gauge.params.gauge.colorSchema = 'Green to Red';

                $scope.showJobXfer = false;
                $scope.showJobTimeSeries = true;
            });


        } else if ($job_type === 'stage-in-tx' || $job_type === 'stage-out-tx') {
            // transfer jobs
            $http.get('../api/panorama/get/job/xfer/' + $wf_id + '/' + $job_id + '/' + $job_type + '/' + $job_duration).then((response) => {
                $scope.job_xfer = response.data;

                let speed_series = [{x: 0, y: 0}];
                let bytes_series = [];
                let cbytes_series = [{x: 0, y: 0}];
                $scope.job_xfer.effective_duration = 0;
                $scope.job_xfer.total_bytes = 0;

                for (let i = 0, len = $scope.job_xfer.records.length; i < len; i++) {
                    speed_series.push({
                        x: $scope.job_xfer.records[i].step,
                        y: $scope.job_xfer.records[i].mbps,
                    });
                    cbytes_series.push({
                        x: $scope.job_xfer.records[i].step,
                        y: $scope.job_xfer.records[i].cum_bytes_transferred / 1024 / 1024,
                    });
                    bytes_series.push({
                        x: $scope.job_xfer.records[i].step,
                        y: $scope.job_xfer.records[i].bytes_transferred / 1024 / 1024,
                    });
                    $scope.job_xfer.total_bytes = $scope.job_xfer.total_bytes + $scope.job_xfer.records[i].bytes_transferred / 1024 / 1024;
                    $scope.job_xfer.effective_duration = $scope.job_xfer.effective_duration + $scope.job_xfer.records[i].duration;
                }

                $scope.job_xfer.total_bytes = $scope.job_xfer.total_bytes.toFixed(2);

                let Vis = Private(VisProvider);

                // gauge speed
                let avg_speed = 0;
                let sum_steps = 0;
                for (let i = 0, len = $scope.job_xfer.records.length; i < len; i++) {
                    let rec = $scope.job_xfer.records[i];
                    avg_speed = avg_speed + (rec.mbps * rec.duration);
                    sum_steps = sum_steps + rec.duration;
                }
                avg_speed = avg_speed / sum_steps;
                $scope.job_xfer.avg_speed = avg_speed.toFixed(2);
                $scope.metricXferSpeedData = {
                    'tables': [
                        {
                            columns: [{title: 'Mbps'}],
                            rows: [[avg_speed.toFixed(2)]]
                        }
                    ]
                };
                $scope.metricXferSpeed = new Vis('panorama', {type: 'metric'});
                $scope.metricXferSpeed.params.addLegend = false;
                $scope.metricXferSpeed.params.addTooltip = false;
                $scope.metricXferSpeed.params.metric.style.bgColor = true;
                $scope.metricXferSpeed.params.metric.style.bgFill = '#f7f7f7';
                $scope.metricXferSpeed.params.metric.style.fontSize = 30;

                // transfer speed
                let speed_s = [];
                for (let i = 0, len = $scope.job_xfer.records.length; i < len; i++) {
                    let rec = $scope.job_xfer.records[i];
                    for (let j = 0; j < rec.duration; j = j + 5) {
                        speed_s.push({
                            x: (rec.step - rec.duration) + j,
                            y: rec.mbps
                        })
                    }
                }

                $scope.speedXferData = {
                    xAxisLabel: 'Transfer Duration (s)',
                    series: [
                        {
                            label: 'speed',
                            values: speed_s
                        }
                    ]
                };
                $scope.speedXfer = new Vis('panorama');
                $scope.speedXfer.params.type = 'area';
                $scope.speedXfer.params.mode = 'stacked';
                $scope.speedXfer.params.addTooltip = false;
                $scope.speedXfer.params.addLegend = false;
                $scope.speedXfer.params.valueAxes[0].title.text = 'Mbps';

                // bytes transferred
                $scope.bytesXferData = {
                    xAxisLabel: 'Steps (s)',
                    series: [
                        {
                            label: 'bytes transferred',
                            values: bytes_series
                        }
                    ]
                };
                $scope.bytesXfer = new Vis('panorama');
                $scope.bytesXfer.params.type = 'histogram';
                $scope.bytesXfer.params.mode = 'normal';
                $scope.bytesXfer.params.addTooltip = false;
                $scope.bytesXfer.params.addLegend = false;
                $scope.bytesXfer.params.valueAxes[0].title.text = 'Megabytes';

                // cumulative bytes transferred
                $scope.cumulBytesXferData = {
                    xAxisLabel: 'Transfer Duration (s)',
                    series: [
                        {
                            label: 'bytes transferred',
                            values: cbytes_series
                        }
                    ]
                };
                $scope.cumulBytesXfer = new Vis('panorama');
                $scope.cumulBytesXfer.params.type = 'area';
                $scope.cumulBytesXfer.params.mode = 'stacked';
                $scope.cumulBytesXfer.params.addTooltip = false;
                $scope.cumulBytesXfer.params.addLegend = false;
                $scope.cumulBytesXfer.params.valueAxes[0].title.text = 'Megabytes';

                $scope.showJobTimeSeries = false;
                $scope.showJobXfer = true;
            });
        }
        $('.itt').popup();
    };
});
