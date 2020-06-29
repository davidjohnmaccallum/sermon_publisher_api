const express = require('express')
const functions = require('./functions')
const app = express()

app.get('/getUsage/:bucketName', functions.getUsage)
app.get('/createBucket/:bucketName', functions.createBucket)

app.use((err, req, res, next) => {
  res.status(500).type('text').send(err.stack)
  console.error(err.stack)
})

module.exports = app
