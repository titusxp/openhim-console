'use strict';
/* global getHashAndSalt: false */
/* global isValidMSISDN: false */

angular.module('openhimWebui2App')
  .controller('ProfileCtrl', function ($scope, Api, login, Alerting) {

    var consoleSession = localStorage.getItem('consoleSession');
    consoleSession = JSON.parse(consoleSession);
    $scope.consoleSession = consoleSession;


    /* -------------------------Initial load & onChanged---------------------------- */
    var querySuccess = function (user) {
      $scope.user = user;
    };

    var queryError = function (err) {
      // on error - add server error alert
      Alerting.AlertAddServerMsg(err.status);
    };

    // do the initial request
    Api.Users.get({ email: $scope.consoleSession.sessionUser }, querySuccess, queryError);
    /* -------------------------Initial load & onChanged---------------------------- */


    /* -------------------------Processing save request-----------------------------*/
    var success = function (password) {
      // add the success message
      if (password !== '') {
        //re-login with new credentials

        login.login($scope.consoleSession.sessionUser, password, function (loggedIn) {
          if (loggedIn) {
            Api.Users.get({ email: $scope.consoleSession.sessionUser }, querySuccess, queryError);
          } else {
            error();
          }
        });
      } else {
        Api.Users.get({ email: $scope.consoleSession.sessionUser }, querySuccess, queryError);
      }

      Alerting.AlertReset();
      Alerting.AlertAddMsg('top', 'success', 'Your user details have been updated succesfully.');
    };

    var error = function (err) {
      // add the error message
      Alerting.AlertReset();
      Alerting.AlertAddMsg('top', 'danger', 'An error has occurred while saving your details: #' + err.status + ' - ' + err.data);
    };


    var saveUser = function (user, password) {
      user.$update({}, function(){
        success(password);
      });
    };

    var setHashAndSave = function (user, hash, salt,password) {
      if (typeof salt !== 'undefined' && salt !== null) {
        user.passwordSalt = salt;
      }
      user.passwordHash = hash;
      saveUser(user, password);
    };

    $scope.save = function (user, password) {
      if (password) {
        var h = getHashAndSalt(password);
        user.passwordAlgorithm = h.algorithm;

        setHashAndSave(user, h.hash, h.salt, password);
      } else {
        saveUser(user, '');
      }
    };
    /* -------------------------Processing save request-----------------------------*/

    $scope.isUserValid = function (password, passwordConfirm) {

      // user being updated and no new password supplied
      if (!password){
        return true;
      }else{
        // either user is new or password being updated
        if ( password === passwordConfirm ){
          return true;
        }else{
          return false;
        }
      }

    };

    // assign function to $scope object to validate via ng binding
    $scope.isValidMSISDN = function(inputtxt){
      // util function defined in utils.js
      return isValidMSISDN(inputtxt);
    };

  });
