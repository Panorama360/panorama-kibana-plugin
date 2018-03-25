const app = require('ui/modules').get('apps/panorama', []);

app.controller('workflow', function ($scope, $http, kbnUrl, $routeParams, Private, timefilter) {

    console.log($routeParams.id);
});
