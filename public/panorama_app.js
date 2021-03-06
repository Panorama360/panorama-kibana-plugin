import 'uiExports/visTypes';
import 'uiExports/visResponseHandlers';
import 'uiExports/visRequestHandlers';
import 'uiExports/visEditorTypes';
import 'uiExports/savedObjectTypes';
import 'uiExports/spyModes';
import 'uiExports/fieldFormats';

import { timefilter } from 'ui/timefilter';

// CSS
require('./panorama_app.less');
require('./semantic/dist/semantic.min.css');
require('./semantic/dist/semantic.js');

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

import { Subscription } from 'rxjs';
import { subscribeWithScope } from 'ui/utils/subscribe_with_scope';

app.controller('panorama', function ($scope, $http, kbnUrl, Private) {

    $http.get('../api/panorama/get/wf_ids').then((response) => {
        $scope.workflows = response.data.workflows;
    });

    timefilter.enableAutoRefreshSelector();

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

    $scope.timefilterSubscriptions$ = new Subscription();
    $scope.timefilterSubscriptions$.add(
        subscribeWithScope($scope, timefilter.getRefreshIntervalUpdate$(), {
            next: () => {
                interval = timefilter.getRefreshInterval()
                console.log(interval)

                if (interval.value > 0 && !interval.pause) {
                    function startRefresh() {
                        refresher = $timeout(function () {
                            if (!$scope.running) $scope.search();
                            startRefresh();
                        }, interval.value);
                    }
                  
                    startRefresh();
                }
            }
        })
    );

    /*$scope.$listen(timefilter, 'refreshIntervalUpdate', function () {
        if (refresher) $timeout.cancel(refresher);
        
        interval = timefilter.getRefreshInterval()
        console.log(interval)

        if (interval.value > 0 && !interval.pause) {
            function startRefresh() {
                refresher = $timeout(function () {
                    if (!$scope.running) $scope.search();
                    startRefresh();
                }, interval.value);
            }

            startRefresh();
        }
    });*/
});
