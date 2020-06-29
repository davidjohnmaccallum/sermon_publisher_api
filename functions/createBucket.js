const { Storage } = require('@google-cloud/storage')
const getenv = require('getenv')

/**
 * Creates a bucket to store the users sermons and makes the bucket public.
 *
 * API docs: https://googleapis.dev/nodejs/storage/latest/index.html
 */
module.exports = async (req, res, next) => {
  try {
    const storage = new Storage({
      projectId: getenv('PROJECT_ID'),
      credentials: {
        client_email: getenv('CLIENT_EMAIL'),
        private_key: getenv('PRIVATE_KEY').replace(/\\n/g, '\n'),
      },
    })
    const [bucket] = await storage.createBucket(req.params.bucketName, {
      location: 'EU',
    })
    await bucket.makePublic()
    res.send(`Bucket ${bucket.name} created.`)
  } catch (err) {
    console.log('Error creating bucket', req.params, err)
    res.status(400).send(err.message)
  }
}
