export default function (server) {
    server.route({
        path: '/api/elasticsearch_status/index/{name}',
        method: 'GET',
        handler(req, reply) {
            // more to come here in the next step
            reply("Hello World");
        }
    });
}
