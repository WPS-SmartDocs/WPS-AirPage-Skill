// Programmatic API entry point
const { AirpageClient } = require('./client');
const { loadCredentials, saveCredentials, getStatus } = require('./credentials');
const { parseJsonInput, decodeResult, formatResponse } = require('./utils');

module.exports = { AirpageClient, loadCredentials, saveCredentials, getStatus, parseJsonInput, decodeResult, formatResponse };
