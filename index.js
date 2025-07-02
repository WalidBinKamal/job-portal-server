const express = require('express');
const cors = require('cors');
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())

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

        // jobs related APIs
        app.get('/jobs', async (req, res) => {
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
        app.get('/job-application', async (req, res) => {
            const email = req.query.email
            const query = { applicant_email: email }
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

        app.post('/job-application', async (req, res) => {
            const application = req.body
            const result = await jobApplicationCollection.insertOne(application)
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