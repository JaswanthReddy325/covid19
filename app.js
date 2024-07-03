const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const app = express()

const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const path = require('path')
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
app.use(express.json())
let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

app.post('/login', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})
const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.get('/states/', authenticateToken, async (request, response) => {
  try {
    const query = `select state_id as stateId,state_name as stateName,population from state;`
    const array = await db.all(query)
    response.send(array)
  } catch (e) {
    console.log(e.message)
  }
})

app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  try {
    const {stateId} = request.params
    const query = `select state_id as stateId,state_name as stateName,population from state where state_id=${stateId};`
    const array = await db.get(query)
    response.send(array)
  } catch (e) {
    console.log(e.message)
  }
})

app.post('/districts/', authenticateToken, async (request, response) => {
  try {
    const districtDetails = request.body
    const {districtName, stateId, cases, cured, active, deaths} =
      districtDetails
    const query = `INSERT INTO
    district (state_id, district_name, cases, cured, active, deaths)
  VALUES
    (${stateId}, '${districtName}', ${cases}, ${cured}, ${active}, ${deaths});`
    const array = await db.run(query)
    let districtId = array.lastID
    response.send('District Successfully Added')
  } catch (e) {
    console.log(e.message)
  }
})
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    try {
      const {districtId} = request.params
      const query = `select district_id as districtId,district_name as districtName,state_id as stateId,cases,cured,active,deaths from district where district_id=${districtId};`
      const array = await db.get(query)
      response.send(array)
    } catch (e) {
      console.log(e.message)
    }
  },
)

app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    try {
      const {districtId} = request.params

      const query = `delete  from district where district_id=${districtId};`
      await db.run(query)

      response.send('District Removed')
    } catch (e) {
      console.log(e.message)
    }
  },
)

app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    try {
      const districtDetails = request.body
      const {districtId} = request.params
      const {districtName, stateId, cases, cured, active, deaths} =
        districtDetails
      const query = `update district set  district_name='${districtName}', state_id=${stateId}, cases=${cases}, cured=${cured}, active=${active}, deaths=${deaths} where district_id=${districtId} ;`
      const array = await db.run(query)

      response.send('District Details Updated')
    } catch (e) {
      console.log(e.message)
    }
  },
)

app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    try {
      const {stateId} = request.params
      const query = `select sum(cases) as totalCases ,sum(cured) as totalCured ,sum(active) as totalActive ,sum(deaths) as totalDeaths  where state_id=${stateId};`
      const array = await db.get(query)

      response.send(array)
    } catch (e) {
      console.log(e.message)
    }
  },
)

initializeDBAndServer()
module.exports = app
