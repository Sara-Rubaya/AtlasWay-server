const express = require('express')
require('dotenv').config()
const cors = require('cors')
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 3000;

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
   
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




//middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res) =>{
    res.send('AtlasWay is cooking')
})



app.listen(port, () =>{
    console.log(`AtlastWay is running on port ${port}`)
})

