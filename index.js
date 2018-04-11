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
                order: -999,
                icon: 'plugins/panorama/img/icon.png',
                main: 'plugins/panorama/panorama_app',
                uses: [
                    'visTypes',
                    'visResponseHandlers',
                    'visRequestHandlers',
                    'visEditorTypes',
                    'savedObjectTypes',
                    'spyModes',
                    'fieldFormats',
                ],

                injectVars: (server) => {
                    return server.plugins.kibana.injectVars(server);
                }
            }
        },

        init: require('./init.js')
    });
};