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
                                    'event': 'stampede.job.info'
                                }
                            }
                        }
                    }
                }
            }).then(response => {
                let data = {'wf_ids': []};
                for (let i = 0, len = response.hits.hits.length; i < len; i++) {
                    if (data.wf_ids.indexOf(response.hits.hits[i]._source['xwf.id']) < 0) {
                        data.wf_ids.push(response.hits.hits[i]._source['xwf.id']);
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
                size: 50,
                body: {
                    query: {
                        bool: {
                            must: {
                                match: {'xwf.id': request.params.wf_id}
                            },
                            should: [
                                {term: {'event': 'stampede.job.edge'}},
                                {term: {'event': 'stampede.job.info'}}
                            ],
                            minimum_should_match: 1,
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
                            job = {'job_id': job_id, parents: [], children: []};
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
                                parents: [],
                                children: [child]
                            });
                        }
                        if (childNotSet) {
                            data.jobs.push({
                                'job_id': child,
                                parents: [parent],
                                children: []
                            });
                        }
                    }
                }
                console.log(data);
                reply(data);
            })
        }
    });
}
