const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000

app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true,
}))
app.use(express.json())
app.use(cookieParser())

const logger = async (req, res, next) => {
    console.log('inside the logger')
    next()
}

const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized access' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized access' })
        }
        req.user = decoded
        next()
    })
}



app.get('/', (req, res) => {
    res.send('Job is falling from the sky')
})

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7rlpdj6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");


        const jobsCollection = client.db('jobPortal').collection('jobs')
        const jobApplicationCollection = client.db('jobPortal').collection('job_applications')

        //Auth related APIS
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '5h'
            })
            res
                .cookie('token', token, {
                    httpOnly: true,
                    secure: false,
                })
                .send({ success: true })
        })

        // jobs related APIs
        app.get('/jobs', logger, async (req, res) => {
            console.log('now inside api call back')
            const email = req.query.email
            let query = {}
            if (email) {
                query = { hr_email: email }
            }
            const cursor = jobsCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)
        })

        app.get('/jobs/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await jobsCollection.findOne(query)
            res.send(result)
        })

        app.post('/jobs', async (req, res) => {
            const newJob = req.body
            const result = await jobsCollection.insertOne(newJob)
            res.send(result)
        })

        // Job application apis
        // job all data, get one data, get some data
        app.get('/job-application', verifyToken, async (req, res) => {
            const email = req.query.email
            const query = { applicant_email: email }

            if (req.user.email !== req.query.email){
                return res.status(403).send('Forbidden Access')
            }

                const result = await jobApplicationCollection.find(query).toArray()

            //fokira way to aggregate data
            for (const application of result) {
                // console.log(application.job_id)
                const query1 = { _id: new ObjectId(application.job_id) }
                const job = await jobsCollection.findOne(query1)
                if (job) {
                    application.title = job.title
                    application.company = job.company
                    application.company_logo = job.company_logo
                    application.location = job.location
                }
            }
            res.send(result)
        })

        app.get('/job-application/jobs/:job_id', async (req, res) => {
            const jobId = req.params.job_id
            const query = { job_id: jobId }
            const result = await jobApplicationCollection.find(query).toArray()
            res.send(result)
        })

        app.post('/job-application', async (req, res) => {
            const application = req.body
            const result = await jobApplicationCollection.insertOne(application)

            //not the best way (use aggregate)
            const id = application.job_id
            const query = { _id: new ObjectId(id) }
            const job = await jobsCollection.findOne(query)
            // console.log(job)
            let newCount = 0
            if (job.applcationCount) {
                newCount = job.applcationCount + 1
            } else {
                newCount = 1
            }

            //now update the job info
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    applicationCount: newCount
                }
            }
            const updatedResult = await jobsCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

        app.patch('/job-application/:id', async (req, res) => {
            const id = req.params.id
            const data = req.body
            const filter = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: {
                    status: data.status
                },
            }
            const result = await jobApplicationCollection.updateOne(filter, updatedDoc)
            res.send(result)
        })

    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`Job is waiting at: ${port}`)
})