import express from 'express'
import dotenv from 'dotenv'
import connectDB from './config/db.js'
dotenv.config()
import authRouter from './routes/auth.route.js'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import userRouter from './routes/user.route.js'
import interviewRouter from './routes/interview.route.js'

const app = express()

const port = process.env.PORT || 5000
app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin: "https://interviewiq-client-q7h6.onrender.com",
    credentials: true
}))

app.use('/api/auth', authRouter)
app.use('/api/user', userRouter)
app.use('/api/interview', interviewRouter)


app.listen(port, ()=>{
    connectDB()
    console.log("Server started")
})
