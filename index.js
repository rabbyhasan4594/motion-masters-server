const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000


//middleware
const corsOptions = {
    origin: '*',
    credentials: true,
    optionSuccessStatus: 200,
}
app.use(cors(corsOptions));
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2yyawyx.mongodb.net/?retryWrites=true&w=majority`;

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
        client.connect();



        const classesCollection = client.db('motionMasters').collection('classes');
        const usersCollection = client.db('motionMasters').collection('users');
        const selectedCollection = client.db('motionMasters').collection('selected');
        const paymentCollection = client.db("motionMasters").collection("payments");




        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2h' })

            res.send({ token })
        })

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }




        app.get('/myClasses', async (req, res) => {
            const email = req.query.email;
            console.log(email);
            if (!email) {
                res.send([]);
            }
            const query = { instructorEmail: email };
            const result = await classesCollection.find(query).toArray();
            res.send(result);
        });

        //enroll api

        app.get('/selected', async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }
            // const query = { email: email };
            const result = await selectedCollection.find(
                {   
                    email: email,
                    payment:"no"
                    
                }).toArray();
            res.send(result);
        });
        app.get('/selectedPayment', async (req, res) => {
            const email = req.query.email;

            if (!email) {
                res.send([]);
            }
            // const query = { email: email };
            const result = await selectedCollection.find(
                {   
                    email: email,
                    payment: "yes"
                }).toArray();
            res.send(result);
        });

        app.post('/selected', async (req, res) => {
            const item = req.body;
            

            const query = { email: item.email, _id: item._id }
            const existingSelected = await selectedCollection.findOne(query);

            if (existingSelected) {
                return res.send({ message: 'user already Selected' })
            }

            const result = await selectedCollection.insertOne(item);

            res.send(result);
        })




        app.patch('/selected/payment/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $inc: { availableSeats: -1 },
                $set: { payment: "yes" }
            };

            const result = await selectedCollection.updateOne(filter, updateDoc);
            res.send(result);

        })
        app.delete('/selected/class/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedCollection.deleteOne(query);
            res.send(result);
        })




        app.get("/dashboard/payment/:id", async (req, res) => {
            const id = req.params.id;
            console.log(id);
           
            const result = await selectedCollection.findOne({
                _id: new ObjectId(id)
            });
            console.log(result);
            res.send(result);
        });




        // users related api


        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        });
        //verify admin 
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        });

        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result);
        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        })


        app.get('/classesAndInstructorsApproved', async (req, res) => {

            const result = await classesCollection.find({
                status: "approved"
            }).toArray();
            res.send(result);
        })
        app.get('/classesAndInstructors', async (req, res) => {

            const result = await classesCollection.find().toArray();
            res.send(result);
        })

        app.patch('/classesAndInstructors/approve/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'approved'
                },
            };

            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);

        })
        app.patch('/classesAndInstructors/deny/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'denied'
                },
            };

            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        app.patch('/classesAndInstructors/payment/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $inc: { enroll: 1, availableSeats: -1 }
            };
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);

        })


        app.post('/classesAndInstructors', verifyJWT, async (req, res) => {
            const newClass = req.body;
            const result = await classesCollection.insertOne(newClass)
            res.send(result);
        })
        app.get('/popular', async (req, res) => {
            const result = await classesCollection.find({
                status: 'approved'
            }).sort({ enroll: -1 }).limit(6).toArray();
            res.send(result);
        })


        //payment
        app.post('/payment', verifyJWT, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);

            res.send(insertResult);
        })




        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({

                amount: amount,
                currency: "usd",
                payment_method_types: [
                    "card"
                ],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });

        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Dancing start')
})
app.listen(port, () => {
    console.log(`Dancing is running on port ${port}`)
})
