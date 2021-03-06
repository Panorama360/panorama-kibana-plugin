export default function (server) {
    server.route({
        path: '/api/panorama/get/wf_ids',
        method: 'GET',
        async handler(request, reply) {
            const {callWithRequest} = server.plugins.elasticsearch.getCluster('data');
            const response = await callWithRequest(request, 'search', {
                index: 'panorama_stampede',
                size: 100,
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
            });
            let data = {'workflows': []};
            for (let i = 0, len = response.hits.hits.length; i < len; i++) {
                let res = response.hits.hits[i];
                let has_wf = false;
                let wf_id = res._source['root_xwf_id'];

                for (let j = 0, len = data.workflows.length; j < len; j++) {
                    if (data.workflows[j].id === wf_id) {
                        has_wf = true;
                        break;
                    }
                }
                if (!has_wf) {
                    data.workflows.push({
                        id: wf_id,
                        label: res._source['dax_label'],
                        start: new Date(res._source['ts'] * 1000).toLocaleString()
                    });
                }
            }
            return data;
        }
    });

    server.route({
        path: '/api/panorama/get/wf/{wf_label}/{wf_id}',
        method: 'GET',
        async handler(request, reply) {
            const {callWithRequest} = server.plugins.elasticsearch.getCluster('data');
            const response = await callWithRequest(request, 'search', {
                index: 'panorama_stampede',
                size: 1000,
                body: {
                    query: {
                        bool: {
                            should: [
                                {match: {'xwf.id': request.params.wf_id}},
                                {match: {'event': 'stampede.job.edge'}},
                                {match: {'event': 'stampede.job.info'}},
                                {match: {'xwf_id': request.params.wf_id}},
                                {match: {'event': 'stampede.job_inst.main.start'}},
                                {match: {'event': 'stampede.inv.end'}},
                                {match: {'event': 'stampede.job_inst.submit.end'}},
                                {match: {'event': 'stampede.xwf.start'}},
                                {match: {'event': 'stampede.xwf.end'}}
                            ],
                            minimum_should_match: 2,
                            boost: 1.0
                        }
                    },
                    sort: {"@timestamp": "asc"}
                }
            });
            let data = {
                wf_id: request.params.wf_id,
                wf_label: request.params.wf_label,
                start: 0,
                start_ts: 0,
                end: 0,
                end_ts: 0,
                makespan: 0,
                status: 'Running',
                status_color: 'green',
                jobs: []
            };
            let res = response.hits.hits;
            let end = 0;

            for (let i = 0, len = res.length; i < len; i++) {

                if (res[i]._source['event'] === 'stampede.xwf.start') {
                    data.start_ts = res[i]._source['ts'];
                    data.start = new Date(data.start_ts * 1000).toLocaleString();
                    data.status = 'Running';
                    data.status_color = 'green';
                    data.reason = '';
                    data.end = 0;

                } else if (res[i]._source['event'] === 'stampede.xwf.end') {
                    end = res[i]._source['ts'];
                    data.makespan = (parseInt(end) - parseInt(data.start_ts)).toLocaleString(undefined);
                    data.end = new Date(end * 1000).toLocaleString();
                    data.end_ts = end;

                    if (res[i]._source['status'] === 0) {
                        data.status = 'Completed';
                        data.status_color = 'blue';
                    } else if (res[i]._source['status'] === -1 || res[i]._source['status'] > 0) {
                        data.status = 'Failed';
                        data.status_color = 'red';
                        if (res[i]._source['reason']) {
                            data.reason = res[i]._source['reason'];
                        }
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
                        job = {job_id: job_id, status: 0, parents: [], children: []};
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
                            job_id: parent,
                            status: 0,
                            parents: [],
                            children: [child]
                        });
                    }
                        
                    if (childNotSet) {
                        data.jobs.push({
                            job_id: child,
                            status: 0,
                            parents: [parent],
                            children: []
                        });
                    }

                } else if (res[i]._source['event'] === 'stampede.job_inst.main.start') {
                    let job_id = res[i]._source['job_id'];
                    let sched_id = res[i]._source['sched_id'];
                    let job = null;
                    for (let j = 0, len = data.jobs.length; j < len; j++) {
                        if (data.jobs[j].job_id === job_id) {
                            job = data.jobs[j];
                            break;
                        }
                    }
                    if (!job) {
                        job = {job_id: job_id, status: 2, parents: [], children: []};
                        data.jobs.push(job);
                    } else if (job.status < 2) {
                        job.status = 2;
                    }
                    job.sched_id = sched_id;

                } else if (res[i]._source['event'] === 'stampede.inv.end') {
                    let job_id = res[i]._source['job_id'];
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
                    let job_id = res[i]._source['job_id'];
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

            return data;
        }
    });

    server.route({
        path: '/api/panorama/get/wf/series/{wf_id}/{wf_start}/{bin_size}',
        method: 'GET',
        async handler(request, reply) {
            const {callWithRequest} = server.plugins.elasticsearch.getCluster('data');
            const response_kickstart = await callWithRequest(request, 'search', {
                index: 'panorama_kickstart',
                size: 1000,
                body: {
                    query: {
                        bool: {
                            should: [
                                {match: {'wf_uuid': request.params.wf_id}},
                                {match: {'event': 'kickstart.inv.online'}}
                            ],
                            minimum_should_match: 2,
                            boost: 1.0
                        }
                    },
                    sort: {"@timestamp": "asc"}
                }
            });

            let data = {};
            let start_time = request.params.wf_start;
            let crchar = 0;
            let cwchar = 0;
            let prev_iowait = 0;

            for (let i = 0, len = response_kickstart.hits.hits.length; i < len; i++) {
                let res = response_kickstart.hits.hits[i];
                let job_id = res._source['dag_job_id'];
                let curr_time = parseInt((res._source['ts'] - start_time) / request.params.bin_size) * request.params.bin_size;

                if (data[curr_time] === undefined) {
                    data[curr_time] = {};
                }

                if (data[curr_time][job_id] === undefined) {
                    data[curr_time][job_id] = {
                        cpu: [],
                        threads: 0,
                        rchar: 0,
                        wchar: 0,
                        crchar: 0,
                        cwchar: 0,
                        iowait: 0,
                        prev_iowait: 0,
                        transferred: 0,
                        ctransferred: 0
                    };
                }
                
                data[curr_time][job_id].cpu.push(res._source['utime'] / (res._source['utime'] + res._source['stime']));
                data[curr_time][job_id].threads = Math.max(data[curr_time][job_id].threads, res._source['threads']);
                data[curr_time][job_id].rchar += res._source['rchar'];
                data[curr_time][job_id].wchar += res._source['wchar'];
                crchar += res._source['rchar'];
                cwchar += res._source['wchar'];
                data[curr_time][job_id].crchar = crchar;
                data[curr_time][job_id].cwchar = cwchar;
                data[curr_time][job_id].iowait = Math.max(data[curr_time][job_id].iowait, res._source['iowait'] - data[curr_time][job_id].prev_iowait);
                data[curr_time][job_id].prev_iowait = res._source['iowait'];
            }

            // get transferred data
            const response_transfer = await callWithRequest(request, 'search', {
                    index: 'panorama_transfer',
                    size: 1000,
                    body: {
                        query: {
                            bool: {
                                should: [
                                    {match: {'wf_uuid': request.params.wf_id}},
                                    {match: {'event': 'transfer.inv.go'}},
                                    {match: {'status': 'SUCCEEDED'}}
                                ],
                                minimum_should_match: 3,
                                boost: 1.0
                            }
                        },
                        sort: {"@timestamp": "asc"}
                    }

            });
            
            let cum_bytes_transferred = 0;

            for (let i = 0, len = response_transfer.hits.hits.length; i < len; i++) {
                let res = response_transfer.hits.hits[i];
                let job_id = res._source['dag_job_id'];
                let ts = new Date(res._source['@timestamp']).getTime() / 1000;
                let curr_time = parseInt((ts - start_time) / request.params.bin_size) * request.params.bin_size;

                let transfer_events = res._source['transfer_events'];

                for (let j = 0; j < transfer_events.length; j++) {
                    if (transfer_events[j].code === 'PROGRESS') {
                        let details = JSON.parse(transfer_events[j].details);
                        if (data[curr_time] === undefined) {
                            data[curr_time] = {};
                        }
                        if (data[curr_time][job_id] === undefined) {
                            data[curr_time][job_id] = {
                                cpu: [],
                                threads: 0,
                                rchar: 0,
                                wchar: 0,
                                crchar: 0,
                                cwchar: 0,
                                iowait: 0,
                                prev_iowait: 0,
                                transferred: 0,
                                ctransferred: 0
                            };
                        }
                        data[curr_time][job_id].xfer = details.bytes_transferred;
                        cum_bytes_transferred += details.bytes_transferred;
                        data[curr_time][job_id].cxfer = cum_bytes_transferred;
                        break;
                    }
                }
            }
            
            return data;
        }
    });

    server.route({
        path: '/api/panorama/get/job/{wf_id}/{job_id}/{job_type}/{sched_id}',
        method: 'GET',
        async handler(request, reply) {
            const {callWithRequest} = server.plugins.elasticsearch.getCluster('data');
            const response = await callWithRequest(request, 'search', {
                index: 'panorama_stampede',
                size: 1000,
                body: {
                    query: {
                        bool: {
                            should: [
                                {match: {'event': 'stampede.inv.end'}},
                                {match: {'xwf_id': request.params.wf_id}},
                                {match: {'job_id': request.params.job_id}},
                                {match: {'event': 'stampede.task.monitoring'}},
                                {match: {'sched_id': request.params.sched_id}},
                            ],
                            minimum_should_match: 3,
                            boost: 1.0
                        }
                    },
                    sort: {"@timestamp": "asc"}
                }
            });
            let res = response.hits.hits;
            let data = {
                job_id: request.params.job_id,
                sched_id: request.params.sched_id,
                wf_id: request.params.wf_id,
                type: request.params.job_type,
                remote_cpu_time: 0
            };

            for (let i = 0, len = res.length; i < len; i++) {
                if (res[i]._source['event'] === 'stampede.inv.end' && res[i]._source['inv_id'] >= 0) {
                    data.executable = res[i]._source['executable'];
                    data.duration = parseFloat(res[i]._source['dur']);
                    data.remote_cpu_time = parseFloat(res[i]._source['remote_cpu_time']).toFixed(3);
                    data.exit_code = res[i]._source['exitcode'];

                } else if (res[i]._source['event'] === 'stampede.task.monitoring') {
                    data.io = {
                        nprocs: res[i]._source['nprocs'],
                        runtime: res[i]._source['run_time'],
                        posix_agg_perf: res[i]._source['POSIX_module_data']['agg_perf_by_slowest'].toFixed(2),
                        posix_total_mbytes: (res[i]._source['POSIX_module_data']['total_bytes'] / Math.pow(2,20)).toFixed(2),
                        stdio_agg_perf: res[i]._source['STDIO_module_data']['agg_perf_by_slowest'].toFixed(2),
                        stdio_total_mbytes: (res[i]._source['STDIO_module_data']['total_bytes'] / Math.pow(2,20)).toFixed(2),
                        // TODO: add support to MPIIO
                    }
                }
            }

            return data;
        }
    });

    server.route({
        path: '/api/panorama/get/job/series/{wf_id}/{job_id}/{job_type}/{sched_id}',
        method: 'GET',
        async handler(request, reply) {
            const {callWithRequest} = server.plugins.elasticsearch.getCluster('data');
            const response = await callWithRequest(request, 'search', {
                index: 'panorama_kickstart',
                size: 1000,
                body: {
                    query: {
                        bool: {
                            should: [
                                {match: {'wf_uuid': request.params.wf_id}},
                                {match: {'dag_job_id': request.params.job_id}},
                                {match: {'event': 'kickstart.inv.online'}}
                            ],
                            minimum_should_match: 3,
                            boost: 1.0
                        }
                    },
                    sort: {"@timestamp": "asc"}
                }
            });

            let res = response.hits.hits;
            let data = {
                job_id: request.params.job_id,
                wf_id: request.params.wf_id,
                type: request.params.job_type,
                records: []
            };

            let start_time = 0;
            let rchar = 0;
            let wchar = 0;
            let prev_iowait = 0;

            for (let i = 0, len = res.length; i < len; i++) {
                if (start_time === 0) {
                    start_time = res[i]._source['ts'] - (res[i]._source['utime'] + res[i]._source['stime']);
                }
                rchar = rchar + res[i]._source['rchar'];
                wchar = wchar + res[i]._source['wchar'];

                data.records.push({
                    step: (res[i]._source['ts'] - start_time).toFixed(2),
                    utime: res[i]._source['utime'],
                    stime: res[i]._source['stime'],
                    cpu: res[i]._source['utime'] / (res[i]._source['utime'] + res[i]._source['stime']),
                    rchar: res[i]._source['rchar'],
                    wchar: res[i]._source['wchar'],
                    crchar: rchar,
                    cwchar: wchar,
                    iowait: res[i]._source['iowait'] - prev_iowait,
                    threads: res[i]._source['threads']
                });
                prev_iowait = res[i]._source['iowait'];
            }
            
            return data;
        }
    });

    server.route({
        path: '/api/panorama/get/job/xfer/{wf_id}/{job_id}/{job_type}/{job_duration}',
        method: 'GET',
        async handler(request, reply) {
            const {callWithRequest} = server.plugins.elasticsearch.getCluster('data');
            const response = await callWithRequest(request, 'search', {
                index: 'panorama_transfer',
                size: 1000,
                body: {
                    query: {
                        bool: {
                            should: [
                                {match: {'wf_uuid': request.params.wf_id}},
                                {match: {'dag_job_id': request.params.job_id}},
                                {match: {'event': 'transfer.inv.go'}},
                                {match: {'status': 'SUCCEEDED'}}
                            ],
                            minimum_should_match: 4,
                            boost: 1.0
                        }
                    },
                    sort: {"@timestamp": "asc"}
                }
            });

            let res = response.hits.hits;
            let data = {
                job_id: request.params.job_id,
                wf_id: request.params.wf_id,
                type: request.params.job_type,
                duration: request.params.job_duration,
                records: []
            };
            let start_time = 0;
            let cum_bytes_transferred = 0;

            for (let i = 0, len = res.length; i < len; i++) {
                data.files = res[i]._source['files'];
                data.source_endpoint = res[i]._source['source_endpoint_display_name'];
                data.dest_endpoint = res[i]._source['destination_endpoint_display_name'];

                let transfer_events = res[i]._source['transfer_events'];

                for (let j = 0; j < transfer_events.length; j++) {
                    if (transfer_events[j].code === 'PROGRESS') {
                        let details = JSON.parse(transfer_events[j].details);
                        cum_bytes_transferred = cum_bytes_transferred + details.bytes_transferred;

                        if (start_time === 0) {
                            start_time = Date.parse(transfer_events[j].time) - (details.duration * 1000);
                        }
                        data.records.push({
                            step: (Date.parse(transfer_events[j].time) - start_time) / 1000,
                            duration: details.duration,
                            bytes_transferred: details.bytes_transferred,
                            cum_bytes_transferred: cum_bytes_transferred,
                            mbps: details.mbps
                        });
                        break;
                    }
                }
            }
            
            return data;
        }
    });
}
