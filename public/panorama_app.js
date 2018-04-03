// CSS
require('./panorama_app.less');

// Title
document.title = 'Panorama 360 - Kibana';

// Require Kibana integrations
require('ui/autoload/all');
require('ui/chrome');

// Controllers
require('./controllers/workflow_controller');

// Routes
let routes = require('ui/routes');
routes.enable();
routes
    .when('/', {
        template: require('./templates/index.html'),
        controller: 'panorama',
        controllerAs: 'ctrl',
        reloadOnSearch: true,
    })
    .when('/workflow/:id?', {
        template: require('./templates/workflow.html'),
        controller: 'workflow',
        controllerAs: 'ctrl',
        reloadOnSearch: true,
    });

// Setup Panorama app
const app = require('ui/modules').get('apps/panorama', []);


import {PanoramaConstants} from './panorama_constants';
import {DocTitleProvider} from 'ui/doc_title';
import {SavedObjectRegistryProvider} from 'ui/saved_objects/saved_object_registry';
import {notify, fatalError, toastNotifications} from 'ui/notify';
import {timezoneProvider} from 'ui/vis/lib/timezone';
import {recentlyAccessed} from 'ui/persisted_log';


app.controller('panorama', function ($scope, $http, kbnUrl, Private, timefilter) {

    $http.get('../api/panorama/get/wf_ids').then((response) => {
        $scope.workflows = response.data.workflows;
    });

    timefilter.enableAutoRefreshSelector();
    timefilter.enableTimeRangeSelector();

    $scope.topNavMenu = [{
        key: 'new',
        description: 'New Sheet',
        run: function () {
            kbnUrl.change('/');
        },
        testId: 'panoramaNewButton',
    }];

    $scope.getWorkflowTitle = () => "Workflow";

    const init = function () {
        $scope.landingPageUrl = () => `#${PanoramaConstants.LANDING_PAGE_PATH}`;

        $scope.running = false;
        $scope.search();

        $scope.$listen(timefilter, 'fetch', $scope.search);

        $scope.opts = {
            search: $scope.search,
        }
    };

    let refresher;
    $scope.$watchCollection('timefilter.refreshInterval', function (interval) {
        if (refresher) $timeout.cancel(refresher);
        if (interval.value > 0 && !interval.pause) {
            function startRefresh() {
                refresher = $timeout(function () {
                    if (!$scope.running) $scope.search();
                    startRefresh();
                }, interval.value);
            }

            startRefresh();
        }
    });
});