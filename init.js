export default function (server) {
    server.route({
        path: '/api/panorama/get/wf_ids',
        method: 'GET',
        handler(request, reply) {
            const {callWithRequest} = server.plugins.elasticsearch.getCluster('data');
            callWithRequest(request, 'search', {
                index: 'panorama',
                body: {
                    'query': {
                        'match': {
                            "event": 'stampede.job.info'
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
}
