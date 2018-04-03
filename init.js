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
                    let wf_id = response.hits.hits[i]._source['root__xwf__id'];
                    let has_wf = false;
                    for (let j = 0, len = data.workflows.length; j < len; j++) {
                        if (data.workflows[j].id === wf_id) {
                            has_wf = true;
                            break;
                        }
                    }
                    if (!has_wf) {
                        data.workflows.push({
                            id: wf_id,
                            label: response.hits.hits[i]._source['dax__label']
                        });
                    }
                }
                reply(data);
            })
        }
    });

    server.route({
        path: '/api/panorama/get/wf/{wf_id}',
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
                                {match: {'event': 'stampede.job_inst.submit.end'}}
                            ],
                            minimum_should_match: 2,
                            boost: 1.0
                        }
                    }
                }
            }).then(response => {
                let data = {'wf_id': request.params.wf_id, 'jobs': []};
                let res = response.hits.hits;

                for (let i = 0, len = res.length; i < len; i++) {

                    if (res[i]._source['event'] === 'stampede.job.info') {
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
}
