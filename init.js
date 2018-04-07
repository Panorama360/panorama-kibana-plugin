export default function (server) {
    server.route({
        path: '/api/panorama/get/wf_ids',
        method: 'GET',
        handler(request, reply) {
            const {callWithRequest} = server.plugins.elasticsearch.getCluster('data');
            callWithRequest(request, 'search', {
                index: 'panorama',
                body: {
                    query: {
                        bool: {
                            must: {
                                term: {
                                    'event': 'stampede.wf.plan'
                                }
                            }
                        }
                    },
                    sort: {"@timestamp": "desc"}
                }
            }).then(response => {
                let data = {'workflows': []};
                for (let i = 0, len = response.hits.hits.length; i < len; i++) {
                    let res = response.hits.hits[i];
                    let has_wf = false;
                    let wf_id = res._source['root__xwf__id'];

                    for (let j = 0, len = data.workflows.length; j < len; j++) {
                        if (data.workflows[j].id === wf_id) {
                            has_wf = true;
                            break;
                        }
                    }
                    if (!has_wf) {
                        data.workflows.push({
                            id: wf_id,
                            label: res._source['dax__label'],
                            start: new Date(res._source['ts'] * 1000).toUTCString()
                        });
                    }
                }
                reply(data);
            })
        }
    });

    server.route({
        path: '/api/panorama/get/wf/{wf_label}/{wf_id}',
        method: 'GET',
        handler(request, reply) {
            const {callWithRequest} = server.plugins.elasticsearch.getCluster('data');
            callWithRequest(request, 'search', {
                index: 'panorama',
                size: 1000,
                body: {
                    query: {
                        bool: {
                            should: [
                                {match: {'xwf.id': request.params.wf_id}},
                                {match: {'event': 'stampede.job.edge'}},
                                {match: {'event': 'stampede.job.info'}},
                                {match: {'xwf__id': request.params.wf_id}},
                                {match: {'event': 'stampede.inv.start'}},
                                {match: {'event': 'stampede.inv.end'}},
                                {match: {'event': 'stampede.job_inst.submit.end'}},
                                {match: {'event': 'stampede.xwf.start'}},
                                {match: {'event': 'stampede.xwf.end'}}
                            ],
                            minimum_should_match: 2,
                            boost: 1.0
                        }
                    }
                }
            }).then(response => {
                let data = {
                    'wf_id': request.params.wf_id,
                    'wf_label': request.params.wf_label,
                    'start': 0,
                    'end': 0,
                    'makespan': 0,
                    'status': 'Running',
                    'status_color': 'green',
                    'jobs': []
                };
                let res = response.hits.hits;
                let start = 0;
                let end = 0;

                for (let i = 0, len = res.length; i < len; i++) {

                    if (res[i]._source['event'] === 'stampede.xwf.start') {
                        start = res[i]._source['ts'];
                        data['start'] = new Date(start * 1000).toUTCString();

                    } else if (res[i]._source['event'] === 'stampede.xwf.end') {
                        end = res[i]._source['ts'];
                        data['makespan'] = end - start;
                        data['end'] = new Date(end * 1000).toUTCString();

                        if (res[i]._source['status'] === 0) {
                            data['status'] = 'Completed';
                            data['status_color'] = 'blue';
                        } else if (res[i]._source['status'] === -1) {
                            data['status'] = 'Failed';
                            data['status_color'] = 'red';
                        }

                    } else if (res[i]._source['event'] === 'stampede.job.info') {
                        let job_id = res[i]._source['job.id'];
                        let job = null;
                        for (let j = 0, len = data.jobs.length; j < len; j++) {
                            if (data.jobs[j].job_id === job_id) {
                                job = data.jobs[j];
                                break;
                            }
                        }
                        if (!job) {
                            job = {'job_id': job_id, status: 0, parents: [], children: []};
                            data.jobs.push(job);
                        }
                        job.type = res[i]._source['type_desc'];

                    } else if (res[i]._source['event'] === 'stampede.job.edge') {
                        let parent = res[i]._source['parent.job.id'];
                        let child = res[i]._source['child.job.id'];
                        let parentNotSet = true;
                        let childNotSet = true;

                        for (let j = 0, len = data.jobs.length; j < len; j++) {
                            if (data.jobs[j].job_id === parent) {
                                data.jobs[j].children.push(child);
                                parentNotSet = false;
                            } else if (data.jobs[j].job_id === child) {
                                data.jobs[j].parents.push(parent);
                                childNotSet = false;
                            }
                        }
                        if (parentNotSet) {
                            data.jobs.push({
                                'job_id': parent,
                                status: 0,
                                parents: [],
                                children: [child]
                            });
                        }
                        if (childNotSet) {
                            data.jobs.push({
                                'job_id': child,
                                status: 0,
                                parents: [parent],
                                children: []
                            });
                        }

                    } else if (res[i]._source['event'] === 'stampede.inv.start') {
                        let job_id = res[i]._source['job__id'];
                        let job = null;
                        for (let j = 0, len = data.jobs.length; j < len; j++) {
                            if (data.jobs[j].job_id === job_id) {
                                job = data.jobs[j];
                                break;
                            }
                        }
                        if (!job) {
                            job = {'job_id': job_id, status: 2, parents: [], children: []};
                            data.jobs.push(job);
                        } else if (job.status < 2) {
                            job.status = 2;
                        }

                    } else if (res[i]._source['event'] === 'stampede.inv.end') {
                        let job_id = res[i]._source['job__id'];
                        let job = null;
                        for (let j = 0, len = data.jobs.length; j < len; j++) {
                            if (data.jobs[j].job_id === job_id) {
                                job = data.jobs[j];
                                break;
                            }
                        }
                        if (!job) {
                            job = {'job_id': job_id, parents: [], children: []};
                            data.jobs.push(job);
                        }
                        job.status = 3;

                    } else if (res[i]._source['event'] === 'stampede.job_inst.submit.end') {
                        let job_id = res[i]._source['job__id'];
                        let job = null;
                        for (let j = 0, len = data.jobs.length; j < len; j++) {
                            if (data.jobs[j].job_id === job_id) {
                                job = data.jobs[j];
                                break;
                            }
                        }
                        if (!job) {
                            job = {'job_id': job_id, status: 1, parents: [], children: []};
                            data.jobs.push(job);
                        } else if (job.status < 1) {
                            job.status = 1;
                        }
                    }
                }
                // console.log(data);
                reply(data);
            })
        }
    });

    server.route({
        path: '/api/panorama/get/job/{wf_id}/{job_id}',
        method: 'GET',
        handler(request, reply) {
            const {callWithRequest} = server.plugins.elasticsearch.getCluster('data');
            callWithRequest(request, 'search', {
                index: 'panorama',
                size: 1000,
                body: {
                    query: {
                        bool: {
                            should: [
                                {match: {'xwf__id': request.params.wf_id}},
                                {match: {'job__id': request.params.job_id}},
                                {match: {'event': 'stampede.inv.end'}}
                            ],
                            minimum_should_match: 3,
                            boost: 1.0
                        }
                    },
                    sort: {"@timestamp": "asc"}
                }
            }).then(response => {
                let res = response.hits.hits;
                let data = {
                    'job_id': request.params.job_id,
                    'wf_id': request.params.wf_id,
                    'remote_cpu_time': 0
                };

                for (let i = 0, len = res.length; i < len; i++) {
                    if (res[i]._source['inv__id'] >= 0) {
                        data['executable'] = res[i]._source['executable'];
                        data['duration'] = parseFloat(res[i]._source['dur']);
                        data['remote_cpu_time'] = parseFloat(res[i]._source['remote_cpu_time']);
                        data['exit_code'] = res[i]._source['exitcode'];
                    }
                }
                reply(data);
            });
        }
    });
}
