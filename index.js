export default function (kibana) {
    return new kibana.Plugin({
        id: 'panorama',
        name: 'panorama',

        require: ['kibana', 'elasticsearch'],

        uiExports: {
            app: {
                id: 'panorama',
                title: 'Panorama 360',
                description: 'Panorama 360 Kibana plugin',
                order: -100,
                icon: 'plugins/panorama/img/icon.png',
                main: 'plugins/panorama/panorama_app',

                injectVars: (server) => {
                    return server.plugins.kibana.injectVars(server);
                }
            }
        },

        init: require('./init.js')
    });
};