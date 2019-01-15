const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MONGO_URI,  {useNewUrlParser: true })
mongoose.connection.on('connected', () => console.log('db connected!'));
mongoose.set('useFindAndModify', false)

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

/* Monoogse schema and Models */
// sub schema to hold exercise info
const exerciseSchema = new mongoose.Schema({
    description: {type: String, required: true},
    duration: {type: Number, required: true},
    date: {type: Number, default: Date.now()}
  })
// main user schema
const userSchema = new mongoose.Schema({
  username: {type: String, required: true},
  exercises: {type:[exerciseSchema], default: undefined}
})
const User = mongoose.model('User', userSchema)

/* Api endpoints */

// add New user
app.post('/api/exercise/new-user',(req, res)=>{
 if(req.body.username){
   const newUser = {username: req.body.username}
   User.create(newUser,(err,data)=>{
     if(err) return err
     res.json(data)
   })
 }else{// no username entered
   res.json({error: 'Specify Username'})
 }
})

// get all users
app.get('/api/exercise/users',(req, res)=>{
  User.find({},{username: 1},(err, data)=>{
    if(err) return err
    res.json(data)
  })
})

// get exersise log
app.get('/api/exercise/log',(req, res)=>{
  const {userId, from, to, limit } = req.query
  // verify from to and limit if empty or not proper dates written null
  const startDate = new Date(from) instanceof Date && !isNaN(new Date(from)) ? (new Date(from)).getTime() : 0
  const endDate = new Date(to) instanceof Date && !isNaN(new Date(to)) ? (new Date(to)).getTime() : null
  const Limit = limit ? Number(limit) : null

  if(!userId) res.json({error: "Invalid UserId in query, please use /api/exercise/log?userId=<userId>"})
  else{// query entered correctly
    User.findById(userId,(err, data)=>{
      // wanted to chain requests here to filter data but was unable to since #elemMatch was returning only the
      // first result of the exercise array, otherwise may have had to use aggregate, so used plain js to filter
      // the data below
      if(err) res.json({error: err.message})
      else { // data found
        const report = {
          id: data._id,
          username: data.username,
          Total: data.exercises ? data.exercises.length : 0
        }
        if(data.exercises){// this block will not execute if no exercises have been entered by user
          const filterByDates = data.exercises.filter((e)=>{
            return endDate ? (e.date >= startDate && e.date <= endDate) : e.date >= startDate
          })
          report.exercises = Limit ? filterByDates.slice(0,Limit) : filterByDates
          report.Total = report.exercises.length
        }
        res.json(report)
      }
    })
  }
})

// update exercise
app.post('/api/exercise/add', (req,res)=>{
  const { userId, description, duration, date} = req.body
  User.findById(userId, (err, data)=>{
    if(err) res.json({error: err.message})
    else{
      const newExercise = {
        description,
        duration,
        date: date ? new Date(date) : Date.now()
      }
      const updateQuery = data.exercises ? [...data.exercises, newExercise] : [newExercise]
      //important validators will not run for updates if runValidators: true is not included
      User.findByIdAndUpdate(userId, { exercises: updateQuery }, {new : true, runValidators: true}, (err, data)=>{
        if(err) res.json({error: err.message})
        res.json(data)
      })
    }
  })
})
// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
