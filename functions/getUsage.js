const monitoring = require('@google-cloud/monitoring')
const moment = require('moment-timezone')
const fetch = require('node-fetch')
const getenv = require('getenv')

const networkCostPerGbUSD = getenv.float('NETWORK_COST_PER_GB_USD')
let ZAR_USD_rate

/**
 * Tells the user how much he/she owes and gives details of usage.abs
 *
 * API docs: https://googleapis.dev/nodejs/monitoring/latest/
 */
module.exports = async (req, res, next) => {
  fetch('https://api.exchangeratesapi.io/latest?base=USD&symbols=ZAR')
    .then((res) => res.json())
    .then((forexResult) => {
      ZAR_USD_rate = forexResult.rates.ZAR
      const oneDay = 60 * 60 * 24
      const metricsClient = new monitoring.MetricServiceClient({
        projectId: getenv('PROJECT_ID'),
        credentials: {
          client_email: getenv('CLIENT_EMAIL'),
          private_key: getenv('PRIVATE_KEY').replace(/\\n/g, '\n'),
        },
      })
      return metricsClient.listTimeSeries({
        name: metricsClient.projectPath('sermon-publish'),
        filter: `metric.type="storage.googleapis.com/network/sent_bytes_count" AND resource.labels.bucket_name="${req.params.bucketName}"`,
        interval: {
          startTime: {
            // seconds: moment().startOf('month').subtract(1, 'months').unix(),
            seconds: moment().startOf('day').subtract(1, 'week').unix(),
          },
          endTime: {
            seconds: moment().endOf('day').unix(),
          },
        },
        aggregation: {
          alignmentPeriod: {
            seconds: oneDay,
          },
          crossSeriesReducer: 'REDUCE_SUM',
          perSeriesAligner: 'ALIGN_SUM',
        },
      })
    })
    .then((listTimeSeriesResult) => {
      // console.log(JSON.stringify(listTimeSeriesResult, null, 4))
      const sentBytesTimeSeries = listTimeSeriesResult[0][0]
      // For each month
      // Create a new object
      // Calculate total usage for month
      // Add an array of days

      // TODO: filter by user
      const result = !sentBytesTimeSeries
        ? []
        : sentBytesTimeSeries.points
            .map((point) => {
              const day = moment
                .unix(point.interval.endTime.seconds)
                .format('ddd DD MMMM')
              const month = moment
                .unix(point.interval.endTime.seconds)
                .format('MMMM')
              const data = parseInt(point.value.int64Value)
              const dataPretty = (data / 1024 / 1024 / 1024).toFixed(2) + 'Gb'
              const costUSD = (data / 1024 / 1024 / 1024) * networkCostPerGbUSD
              const costZAR = costUSD * ZAR_USD_rate
              const costZARPretty = 'R' + (costUSD * ZAR_USD_rate).toFixed(2)
              return {
                day,
                month,
                data,
                dataPretty,
                costUSD,
                costZAR,
                costZARPretty,
              }
            })
            .reduce((accumulator, day) => {
              if (!accumulator[day.month]) {
                accumulator[day.month] = {
                  month: day.month,
                  data: 0,
                  dataPretty: undefined,
                  costUSD: 0,
                  costZAR: 0,
                  costZARPretty: undefined,
                  days: [],
                }
              }
              const month = accumulator[day.month]
              month.data += day.data
              month.dataPretty =
                (month.data / 1024 / 1024 / 1024).toFixed(2) + 'Gb'
              month.costUSD += day.costUSD
              month.costZAR += day.costZAR
              month.costZARPretty = 'R' + month.costZAR.toFixed(2)
              month.days.push(day)
              return accumulator
            }, {})

      return res.send(Object.values(result))
    })
    .catch((err) => {
      console.error('Error getting usage', req.params, err)
      res.status(400).send(err.message)
    })
}
