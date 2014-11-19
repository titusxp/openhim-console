'use strict';
//TODO it may be good to integrate d3 in a more 'angular', e.g. using directives
/* global d3: false */
/* global moment: false */

angular.module('openhimWebui2App')
  .controller('VisualizerCtrl', function ($scope, $http, $interval, login, Api, Alerting) {

    $scope.loadingVisualizer = true;
    $scope.loadingVisualizerError = false;
    $scope.loadingVisualizerErrorMsgs = [];


    // initialize global variables
    var registries = [];
    var endpoints = [];
    var himRect, himText, visW, visH, pad, himX, himY, himW, himH, inactiveColor, activeColor, errorColor, textColor;
    var visualizerUpdateInterval, updatePeriod, diffTime, lastUpdate, speed, maxSpeed, maxTimeout, vis;


    var consoleSession = localStorage.getItem('consoleSession');
    consoleSession = JSON.parse(consoleSession);
    $scope.consoleSession = consoleSession;

    // get the user settings to construct the visualizer
    Api.Users.get({ email: $scope.consoleSession.sessionUser }, function(user){

      // user doesnt have settings saved
      if ( !user.settings ){
        $scope.loadingVisualizerError = true;
        $scope.loadingVisualizer = false;
        $scope.loadingVisualizerErrorMsgs.push({ section: 'Settings Error', msg: 'There appear to be no settings saved for this user. Please save the user settings' });
        return;
      }

      var visSettings = user.settings.visualizer;

      /********** Visualizations Management **********/
      // setup components (registries)
      angular.forEach(visSettings.components, function(component){
        registries.push({ comp: component.event, desc: component.desc });
      });

      // setup endpoints
      angular.forEach(visSettings.endpoints, function(endpoint){
        endpoints.push({ comp: endpoint.event, desc: endpoint.desc });
      });

      // check if components and registries have events
      if ( registries.length === 0 || endpoints.length === 0 ){
        $scope.loadingVisualizerError = true;
        $scope.loadingVisualizer = false;
        $scope.loadingVisualizerErrorMsgs.push({ section: 'Visualizations Management', msg: 'Please ensure your visualizer has atleast one Component and one Endpoint added!' });
      }
      /********** Visualizations Management **********/


      /********** Size Management **********/
      visW = parseInt( visSettings.size.width );
      visH = parseInt( visSettings.size.height );
      pad = parseInt( visSettings.size.padding );

      himX = 0 + pad;
      himY = visH/2.0;
      himW = visW - 2.0*pad;
      himH = visH/4.0 - 2.0*pad;

      // check if config not empty
      if ( !visW || !visH || !pad ){
        $scope.loadingVisualizerError = true;
        $scope.loadingVisualizer = false;
        $scope.loadingVisualizerErrorMsgs.push({ section: 'Size Management', msg: 'Please ensure all size management fields are supplied!' });
      }
      /********** Size Management **********/


      /********** Color Management **********/
      inactiveColor = '#'+visSettings.color.inactive;
      activeColor = '#'+visSettings.color.active;
      errorColor = '#'+visSettings.color.error;
      textColor = '#'+visSettings.color.text;

      // check if config not empty
      if ( inactiveColor === '#' || activeColor === '#' || errorColor === '#' || textColor === '#' ){
        $scope.loadingVisualizerError = true;
        $scope.loadingVisualizer = false;
        $scope.loadingVisualizerErrorMsgs.push({ section: 'Color Management', msg: 'Please ensure all color management fields are supplied!' });
      }
      /********** Color Management **********/


      /********** Time Management **********/
      //How often to fetch updates from the server (in millis)
      updatePeriod = parseInt( visSettings.time.updatePeriod );

      //play speed; 0 = normal, -1 = 2X slower, -2 = 3X slower, 1 = 2X faster, etc.
      speed = 0;
      maxSpeed = parseInt( visSettings.time.maxSpeed );
      maxTimeout = parseInt( visSettings.time.maxTimeout );

      // check if config not empty
      if ( !updatePeriod || !maxSpeed || !maxTimeout ){
        $scope.loadingVisualizerError = true;
        $scope.loadingVisualizer = false;
        $scope.loadingVisualizerErrorMsgs.push({ section: 'Speed Management', msg: 'Please ensure all speed management fields are supplied!' });
      }
      /********** Time Management **********/


      

      if ( $scope.loadingVisualizer === true ){

        // visualizer loaded - change state
        $scope.loadingVisualizer = false;

        /* execute the visualizer code */
        vis = d3.select('#visualizer')
          .append('svg:svg')
          .attr('width', visW)
          .attr('height', visH);

        setupHIM(vis);
        setupRegistries(vis);
        setupEndpoints(vis);

        sync();
        /* execute the visualizer code */
      }

    }, function(err){
      $scope.loadingVisualizer = false;
      // on error - add server error alert
      Alerting.AlertAddServerMsg(err.status);
    });






    var getRegistryRect = function getRegistryRect(name) {
      for (var i=0; i<registries.length; i++) {
        if (registries[i].comp.toLowerCase() === name.toLowerCase()) {
          return registries[i].rect;
        }
      }
      return null;
    };

    var getEndpointText = function getEndpointText(name) {
      for (var i=0; i<endpoints.length; i++) {
        if (endpoints[i].comp.toLowerCase() === name.toLowerCase()) {
          return endpoints[i].text;
        }
      }
      return null;
    };

    /* Component Drawing */

    var setupBasicComponent = function setupBasicComponent(compRect, compText, x, y, w, h, text) {
      compRect
        .attr('rx', 6)
        .attr('ry', 6)
        .attr('x', x)
        .attr('y', y)
        .attr('width', w)
        .attr('height', h)
        .style('fill', inactiveColor);

      var textSize = h/3.5;
      compText
        .attr('x', x + w/2.0)
        .attr('y', y + h/2.0 + textSize/2.0)
        .attr('text-anchor', 'middle')
        .attr('font-size', textSize)
        .text(text)
        .style('fill', textColor);
    };

    var setupRegistryComponent = function setupRegistryComponent(compRect, compText, compConnector, index, text) {
      var compW = visW/registries.length - 2.0*pad,
        compH = visH/4.0 - 2.0*pad;
      var compX = index*compW + pad + index*pad*2.0,
        compY = 0 + pad;

      setupBasicComponent(compRect, compText, compX, compY, compW, compH, text);

      compConnector
        .attr('x1', compX + compW/2.0)
        .attr('y1', compY + compH)
        .attr('x2', compX + compW/2.0)
        .attr('y2', himY)
        .style('stroke-width', visW/150.0)
        .style('stroke', '#ddd');
    };

    var setupEndpointText = function setupEndpointText(compText, index, text) {
      var compW = visW/endpoints.length - 2.0*pad,
        compH = (visH/4.0 - 2.0*pad) / 3.0;
      var compX = index*compW + pad + index*pad*2.0,
        compY = visH - pad;

      compText
        .attr('x', compX + compW/2.0)
        .attr('y', compY)
        .attr('text-anchor', 'middle')
        .attr('font-size', compH)
        .text(text)
        .style('fill', inactiveColor);
    };

    var setupHIM = function setupHIM(vis) {
      himRect = vis.append('svg:rect');
      himText = vis.append('svg:text');
      setupBasicComponent(himRect, himText, himX, himY, himW, himH, 'Health Information Mediator');

      vis.append('svg:rect')
        .attr('rx', 6)
        .attr('ry', 6)
        .attr('x', 0 + pad)
        .attr('y', visH*3.0/4.0)
        .attr('width', visW - 2.0*pad)
        .attr('height', visH/50.0)
        .style('fill', inactiveColor);
    };

    var setupRegistries = function setupRegistries(vis) {
      for (var i=0; i<registries.length; i++) {
        registries[i].rect = vis.append('svg:rect');
        registries[i].text = vis.append('svg:text');
        registries[i].line = vis.append('svg:line');
        setupRegistryComponent(registries[i].rect, registries[i].text, registries[i].line, i, registries[i].desc);
      }
    };

    var setupEndpoints = function setupEndpoints(vis) {
      for (var i=0; i<endpoints.length; i++) {
        endpoints[i].text = vis.append('svg:text');
        setupEndpointText(endpoints[i].text, i, endpoints[i].desc);
      }
    };

    /* Animation */

    var animateComp = function animateComp(comp, ev, delay, isError) {
      var color;
      var delayMultiplier = 1.0;

      if (ev.toLowerCase() === 'start') {
        color = activeColor;
      } else if (isError) {
        color = errorColor;
      } else {
        color = inactiveColor;
      }

      if (speed<0) {
        delayMultiplier = -1.0*speed + 1.0;
      } else if (speed>0) {
        delayMultiplier = 1.0 / (speed + 1.0);
      }

      comp
        .transition()
        .delay(delay * delayMultiplier)
        .style('fill', color);

      if (ev.toLowerCase() === 'start' || isError) {

        var timeout;
        if ( isError ){
          timeout = 1000;
        }else{
          timeout = maxTimeout;
        }


        comp
          .transition()
          .delay(delay * delayMultiplier + timeout)
          .style('fill', inactiveColor);
      }
    };

    var processEvents = function processEvents(data) {
      if (data.length === 0) {
        return;
      }

      var baseTime = data[0].ts;
      var isErrorStatus = function(status) {
        return typeof status !== 'undefined' && status !== null && status.toLowerCase() === 'error';
      };

      angular.forEach(data, function(item) {
        var comp = null;

        comp = getRegistryRect(item.comp);
        if (comp === null) {
          comp = getEndpointText(item.comp);
          if (typeof comp !== 'undefined' && comp !== null) {
            animateComp(comp, item.ev, item.ts-baseTime, isErrorStatus(item.status));
            animateComp(himRect, item.ev, item.ts-baseTime, isErrorStatus(item.status));
          }
        } else {
          animateComp(comp, item.ev, item.ts-baseTime, isErrorStatus(item.status));
        }
      });
    };

    var play = function play() {
      $scope.showPlay = false;
      $scope.showPause = true;

      lastUpdate = (Date.now()-diffTime);
      visualizerUpdateInterval = $interval( function() {
        Api.VisualizerEvents.get({ receivedTime: lastUpdate}, function (events) {
          processEvents(events.events);
          lastUpdate = (Date.now()-diffTime);
        });
      }, updatePeriod);
    };

    var cancelVisualizerUpdateInterval = function() {
      if (angular.isDefined(visualizerUpdateInterval)) {
        $interval.cancel(visualizerUpdateInterval);
        visualizerUpdateInterval = undefined;
      }
    };

    $scope.play = play;

    $scope.pause = function pause() {
      $scope.showPlay = true;
      $scope.showPause = false;
      cancelVisualizerUpdateInterval();
    };

    $scope.$on('$destroy', cancelVisualizerUpdateInterval);

    var sync = function sync() {
      Api.VisualizerSync.get(function (sync) {
        diffTime = Date.now() - moment(sync.now);
        play();
      });
    };

    $scope.slowDown = function slowDown() {
      if (speed>-1*maxSpeed+1) {
        speed--;
      }
      $scope.speedText = speedText();
    };

    $scope.speedUp = function speedUp() {
      if (speed<maxSpeed-1) {
        speed++;
      }
      $scope.speedText = speedText();
    };

    var speedText = function speedText() {
      if (speed === 0) {
        return '';
      } else if (speed<0) {
        return (-1*speed+1) + 'X Slower';
      } else if (speed>0) {
        return (speed+1) + 'X Faster';
      }
    };

    
  });