import { beautifyIndent, returnContentType, retrieveBodyProperties } from '../utils'

export function TransactionsBodyModalCtrl ($scope, $uibModalInstance, config, Api, Alerting, bodyData) {
  $scope.bodyData = bodyData
  const defaultLengthOfBodyToDisplay = config.defaultLengthOfBodyToDisplay

  if ($scope.bodyData && $scope.bodyData.bodyRangeProperties) {
    const properties = $scope.bodyData.bodyRangeProperties

    $scope.partialBody = properties.partial
    $scope.bodyStart = properties.start
    $scope.bodyEnd = properties.end
    $scope.bodyLength = properties.bodyLength
  }

  // transform body with indentation/formatting
  if ($scope.bodyData && $scope.bodyData.content) {
    if (bodyData.headers && returnContentType(bodyData.headers)) {
      const bodyTransform = beautifyIndent(returnContentType(bodyData.headers), bodyData.content)
      $scope.bodyData.content = bodyTransform.content
    }
  }

  if (
    $scope.bodyData &&
    $scope.bodyData.transactionId &&
    $scope.bodyData.bodyId
  ) {
    $scope.retrieveBodyData = function (start=0, end=defaultLengthOfBodyToDisplay) {
      Api.TransactionBodies($scope.bodyData.transactionId, $scope.bodyData.bodyId, start, end).then(response => {
        const { start, end, bodyLength } = retrieveBodyProperties(response)

        if (start && end && bodyLength) {
          $scope.bodyStart = start
          $scope.bodyEnd = end
          $scope.bodyLength = bodyLength
          $scope.partialBody = (bodyLength - end) > 1
        }

        if (bodyData.headers && returnContentType(bodyData.headers)) {
          let bodyTransform = beautifyIndent(returnContentType(bodyData.headers), response.data)
          $scope.bodyData.content = bodyTransform.content
        }
      }).catch(err => {
        Alerting.AlertAddServerMsg(err.status)
      })
    }
    
    $scope.loadMore = function () {
      $scope.retrieveBodyData(0, 2048)
    }
  
    $scope.loadFull = function () {
      $scope.retrieveBodyData(0, 9999999999999)
    }
  }

  $scope.cancel = function () {
    $uibModalInstance.dismiss('cancel')
  }
}
