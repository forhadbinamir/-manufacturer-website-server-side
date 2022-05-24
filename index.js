const express = require('express');
const cors = require('cors');
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
require('dotenv').config()

const port = process.env.PORT || 5001

app.use(cors())
app.use(express.json())

// user: manufacturer
// pass : TxGdW9ZxMBEpfMPF


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.ACCESS_SECRET_PASS}@cluster0.y263y.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    await client.connect()
    try {
        const manufacturerCollection = client.db("manufacturer-collection").collection("production");
        const userCollection = client.db("manufacturer-collection").collection("users");
        const orderCollection = client.db("manufacturer-collection").collection("orders");

        app.get('/production', async (req, res) => {
            const production = await manufacturerCollection.find().toArray()
            res.send(production)
        })
        app.get('/production/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const production = await manufacturerCollection.findOne(query)
            res.send(production)
        })

        app.post('/orders', async (req, res) => {
            const query = req.body
            const result = await orderCollection.insertOne(query)
            res.send(result)
        })
    }
    finally {

    }
}

run().catch(console.dir)


app.get('/man', (req, res) => {
    res.send("Manufacturer server is running")
})

app.listen(port, () => {
    console.log('Manufacturer port in running', port)
})