import api from './server/routes';

export default function (kibana) {
    return new kibana.Plugin({
        require: ['elasticsearch'],

        uiExports: {
            app: {
                title: 'Panorama 360',
                description: 'Panorama 360 Kibana plugin',
                main: 'plugins/panorama/panorama',
                icon: 'plugins/panorama/icon.png'
            }
        },

        // The init method will be executed when the Kibana server starts and loads
        // this plugin. It is used to set up everything that you need.
        init(server, options) {
            // Just call the api module that we imported above (the server/routes.js file)
            // and pass the server to it, so it can register several API interfaces at the server.
            api(server);
        }

    });
};