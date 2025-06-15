const express = require('express')
require('dotenv').config()
const cors = require('cors')
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;

//middleware
app.use(cors());
app.use(express.json());

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    const database =client.db('atlasway-user')
    const packageCollection = database.collection('packages')

    app.get('/packages', async(req, res)=>{
        const allPackages = await packageCollection.find().toArray()
        console.log(allPackages)
        res.send(allPackages)
    })

    //save a package data in database
    app.post('/add-package', async(req, res) =>{
        const packageData = req.body
        const result = await packageCollection.insertOne(packageData)
        console.log(result)
        res.status(201).send({...result,message: 'data paisi'})
    })
     
    //get single package by id
     app.get('/package/:id', async(req, res)=>{
        const id = req.params.id
        const filter = {_id : new ObjectId(id)}
        const package = await packageCollection.findOne(filter)
        console.log(package)
        res.send(package)
    })

     //get single package by id
     app.get('/my-packages/:email', async(req, res)=>{
        const email = req.params.email
        const filter = { email}
        const packages = await packageCollection.find(filter).toArray()
        console.log(packages)
        res.send(packages)
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






app.get('/', (req, res) =>{
    res.send('AtlasWay is cooking')
})



app.listen(port, () =>{
    console.log(`AtlastWay is running on port ${port}`)
})

