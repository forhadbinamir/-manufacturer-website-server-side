const express = require('express');
const cors = require('cors');
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5001

app.use(cors())
app.use(express.json())


function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization
    console.log(authHeader)
    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized Access' })
    }
    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Access Forbidden' })
        }
        req.decoded = decoded
        console.log(decoded)
        next()
    })

}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.ACCESS_SECRET_PASS}@cluster0.y263y.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    await client.connect()
    try {
        const manufacturerCollection = client.db("manufacturer-collection").collection("production");
        const userCollection = client.db("manufacturer-collection").collection("users");
        const orderCollection = client.db("manufacturer-collection").collection("orders");
        const profileCollection = client.db("manufacturer-collection").collection("userInfo");
        const myCollection = client.db("manufacturer-collection").collection("myorder");
        const paymentCollection = client.db("manufacturer-collection").collection("payment");



        // create payment method api
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            try {
                const service = req.body
                console.log('body', service)
                const price = service.price
                console.log('be', price)
                const amount = price * 100
                console.log("af", amount)
                const paymentIntent = await stripe?.paymentIntents?.create({
                    amount: amount,
                    currency: 'usd',
                    payment_method_types: ['card']
                })
                res.send({ clientSecret: paymentIntent?.client_secret })
            }
            catch {
                res.send(false)
            }

        })

        app.patch('/myorder/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const payment = req.body
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }
            const result = await paymentCollection.insertOne(payment)
            const updateBooking = await myCollection.updateOne(filter, updateDoc)
            res.send(updateBooking)
        })

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email
            const requesterAccount = await userCollection.findOne({ email: requester })
            if (requesterAccount.role === 'admin') {
                next()
            }
            else {
                return res.status(403).send({ message: 'Forbidden access' })
            }
        }

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
        app.post('/production', verifyJWT, async (req, res) => {
            const query = req.body
            const result = await manufacturerCollection.insertOne(query)
            res.send(result)
        })

        app.post('/orders/:email', verifyJWT, async (req, res) => {
            const query = req.body
            const email = req.params.email
            const decodedEmail = req.decoded.email
            if (email === decodedEmail) {
                const result = await orderCollection.insertOne(query)
                res.send(result)
            }

        })
        app.patch('/update/:id', async (req, res) => {
            const id = req.params.id
            const newQuantity = req.body
            const filter = { _id: ObjectId(id) }
            const updateDoc = {
                $set: newQuantity
            }
            const result = await manufacturerCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email
            const user = await userCollection.findOne({ email: email })
            const isAdmin = user.role === 'admin'
            res.send({ admin: isAdmin })
        })

        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray()
            res.send(users)
        })
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email
            const requester = req.decoded.email
            const requesterAccount = await userCollection.findOne({ email: requester })
            if (requesterAccount.role === "admin") {
                const filter = { email: email }
                const updateDoc = {
                    $set: { role: 'admin' }
                }
                const result = await userCollection.updateOne(filter, updateDoc)
                res.send(result)
            }
            else {
                res.status({ message: 'Forbidden' })
            }

        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const filter = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user
            }
            const result = await userCollection.updateOne(filter, updateDoc, options)
            const jotToken = jwt.sign({ email: email }, process.env.ACCESS_SECRET_TOKEN, { expiresIn: "1d" })
            if (jotToken) {
                res.send({ success: true, result, jotToken })
            }
            else {
                res.send({ success: false })
            }
        })

        app.delete('/user/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await userCollection.deleteOne(query)
            res.send(result)
        })

        app.put('/update/:id', async (req, res) => {
            const id = req.params.id
            const updateQuantity = req.body
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    quantity: updateQuantity.quantity
                }
            }
            const result = await manufacturerCollection.updateOne(filter, updateDoc, options)
            res.send(result)
        })

        // insert single person data by this api
        app.post('/myorder', async (req, res) => {
            const query = req.body
            const result = await myCollection.insertOne(query)
            res.send(result)
        })

        // show my order into the client site with thi api
        app.get('/myorder', verifyJWT, async (req, res) => {
            const decodedEmail = req.decoded.email
            console.log(decodedEmail)
            const email = req.query.email
            if (email === decodedEmail) {
                const query = { email: email }
                const result = await myCollection.find(query).toArray()
                res.send(result)
            }
        })
        app.get('/allorder', verifyJWT, async (req, res) => {
            const allOrder = await orderCollection.find().toArray()
            res.send(allOrder)
        })
        app.get('/myorder/:id', verifyJWT, async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await myCollection.findOne(query)
            res.send(result)
        })
        // delete single order by user 
        app.delete('/myorder/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const result = await myCollection.deleteOne(query)
            res.send(result)
        })

        app.post('/profile', async (req, res) => {
            const query = req.body
            const result = await profileCollection.insertOne(query)
            res.send(result)
        })
        app.get('/profile', async (req, res) => {
            const profile = await profileCollection.find().toArray()
            res.send(profile)
        })


    }
    finally {

    }
}

run().catch(console.dir)


app.get('/', (req, res) => {
    res.send("Manufacturer server is running ok")
})

app.listen(port, () => {
    console.log('Manufacturer port in running', port)
})