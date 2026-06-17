const express = require('express');
const serverless = require('serverless-http');
const app = require('../server');

const wrapper = express();
// Ensure it works regardless of how Netlify passes the path
wrapper.use('/.netlify/functions/api', app);
wrapper.use('/', app);

module.exports.handler = serverless(wrapper, {
    binary: ['image/*', 'image/jpeg', 'image/png', 'multipart/form-data', '*/*']
});
