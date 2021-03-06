'use strict'

var _interopRequireDefault = require('@babel/runtime/helpers/interopRequireDefault')

var _extends2 = _interopRequireDefault(
  require('@babel/runtime/helpers/extends')
)

var _require = require('apollo-link'),
  ApolloLink = _require.ApolloLink,
  Observable = _require.Observable,
  fromError = _require.fromError

var _require2 = require('apollo-link-http-common'),
  selectURI = _require2.selectURI,
  selectHttpOptionsAndBody = _require2.selectHttpOptionsAndBody,
  fallbackHttpConfig = _require2.fallbackHttpConfig,
  serializeFetchParameter = _require2.serializeFetchParameter,
  createSignalIfSupported = _require2.createSignalIfSupported,
  parseAndCheckHttpResponse = _require2.parseAndCheckHttpResponse

var _require3 = require('extract-files'),
  extractFiles = _require3.extractFiles,
  ReactNativeFile = _require3.ReactNativeFile

function rewriteURIForGET(chosenURI, body) {
  var queryParams = []

  var addQueryParam = function addQueryParam(key, value) {
    queryParams.push(key + '=' + encodeURIComponent(value))
  }

  if ('query' in body) addQueryParam('query', body.query)
  if (body.operationName) addQueryParam('operationName', body.operationName)

  if (body.variables) {
    var serializedVariables

    try {
      serializedVariables = serializeFetchParameter(
        body.variables,
        'Variables map'
      )
    } catch (parseError) {
      return {
        parseError: parseError
      }
    }

    addQueryParam('variables', serializedVariables)
  }

  if (body.extensions) {
    var serializedExtensions

    try {
      serializedExtensions = serializeFetchParameter(
        body.extensions,
        'Extensions map'
      )
    } catch (parseError) {
      return {
        parseError: parseError
      }
    }

    addQueryParam('extensions', serializedExtensions)
  }

  var fragment = ''
  var preFragment = chosenURI
  var fragmentStart = chosenURI.indexOf('#')

  if (fragmentStart !== -1) {
    fragment = chosenURI.substr(fragmentStart)
    preFragment = chosenURI.substr(0, fragmentStart)
  }

  var queryParamsPrefix = preFragment.indexOf('?') === -1 ? '?' : '&'
  return {
    newURI: preFragment + queryParamsPrefix + queryParams.join('&') + fragment
  }
}

exports.ReactNativeFile = ReactNativeFile

exports.createUploadLink = function(_temp) {
  var _ref = _temp === void 0 ? {} : _temp,
    _ref$uri = _ref.uri,
    fetchUri = _ref$uri === void 0 ? '/graphql' : _ref$uri,
    _ref$fetch = _ref.fetch,
    linkFetch = _ref$fetch === void 0 ? fetch : _ref$fetch,
    fetchOptions = _ref.fetchOptions,
    credentials = _ref.credentials,
    headers = _ref.headers,
    includeExtensions = _ref.includeExtensions

  var linkConfig = {
    http: {
      includeExtensions: includeExtensions
    },
    options: fetchOptions,
    credentials: credentials,
    headers: headers
  }
  return new ApolloLink(function(operation) {
    var uri = selectURI(operation, fetchUri)
    var context = operation.getContext()
    var _context$clientAwaren = context.clientAwareness
    _context$clientAwaren =
      _context$clientAwaren === void 0 ? {} : _context$clientAwaren
    var name = _context$clientAwaren.name,
      version = _context$clientAwaren.version,
      headers = context.headers
    var contextConfig = {
      http: context.http,
      options: context.fetchOptions,
      credentials: context.credentials,
      headers: (0, _extends2.default)(
        {},
        name && {
          'apollographql-client-name': name
        },
        {},
        version && {
          'apollographql-client-version': version
        },
        {},
        headers
      )
    }

    var _selectHttpOptionsAnd = selectHttpOptionsAndBody(
        operation,
        fallbackHttpConfig,
        linkConfig,
        contextConfig
      ),
      options = _selectHttpOptionsAnd.options,
      body = _selectHttpOptionsAnd.body

    var _extractFiles = extractFiles(body),
      clone = _extractFiles.clone,
      files = _extractFiles.files

    var payload = serializeFetchParameter(clone, 'Payload')

    if (files.size) {
      delete options.headers['content-type']
      var form = new FormData()
      form.append('operations', payload)
      var map = {}
      var i = 0
      files.forEach(function(paths) {
        map[++i] = paths
      })
      form.append('map', JSON.stringify(map))
      i = 0
      files.forEach(function(paths, file) {
        form.append(++i, file, file.name)
      })
      options.body = form
    } else {
      var method = options.method.toUpperCase()

      if (method === 'GET') {
        var _rewriteURIForGET = rewriteURIForGET(uri, body),
          newURI = _rewriteURIForGET.newURI,
          parseError = _rewriteURIForGET.parseError

        if (parseError) return fromError(parseError)
        uri = newURI
      } else options.body = payload
    }

    return new Observable(function(observer) {
      var abortController

      if (!options.signal) {
        var _createSignalIfSuppor = createSignalIfSupported(),
          controller = _createSignalIfSuppor.controller

        if (controller) {
          abortController = controller
          options.signal = abortController.signal
        }
      }

      linkFetch(uri, options)
        .then(function(response) {
          operation.setContext({
            response: response
          })
          return response
        })
        .then(parseAndCheckHttpResponse(operation))
        .then(function(result) {
          observer.next(result)
          observer.complete()
        })
        .catch(function(error) {
          if (error.name === 'AbortError') return
          if (error.result && error.result.errors && error.result.data)
            observer.next(error.result)
          observer.error(error)
        })
      return function() {
        if (abortController) abortController.abort()
      }
    })
  })
}
