const express = require('express')
const cors = require('cors')


const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;
const admin = require("firebase-admin");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded)
require('dotenv').config()


// const allow=origin:['http://localhost:5173', 'https://atlasway-client.web.app'] 

// Middleware
app.use(cors({
  origin:['http://localhost:5173', 'https://atlasway-client.web.app'] ,
  credentials: true
}));
app.use(express.json());




// MongoDB Connection
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});




admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ message: 'Unauthorized access: No token or bad format' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    console.log('Decoded token:', decoded);
    req.decoded = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).send({ message: 'Unauthorized access: Token invalid' });
  }
};


const verifyTokenEmail = (req,res,next)=>{
  if(req.query.email !== req.decoded.email){
    return res.status(403).send({message: 'forbidden access'})
  }
  next();

}

async function run() {
  try {
    const database = client.db('atlasway-user');
    const packageCollection = database.collection('packages');
    const bookingCollection = database.collection('bookings');

    // Get all packages
    app.get('/packages', async (req, res) => {
      const allPackages = await packageCollection.find().toArray();
      console.log(allPackages);
      res.send(allPackages);
    });

    // Add a new package
    app.post('/add-package', async (req, res) => {
      const packageData = req.body;
      const result = await packageCollection.insertOne(packageData);
      console.log(result);
      res.status(201).send({ ...result, message: 'data paisi' });
    });

    // Get single package by ID
    app.get('/package/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const singlePackage = await packageCollection.findOne(filter);
      console.log(singlePackage);
      res.send(singlePackage);
    });

    // Get all packages by user's email
    app.get('/my-packages/:email', async (req, res) => {
      const email = req.params.email;
      const filter = { email };
      const userPackages = await packageCollection.find(filter).toArray();
      console.log(userPackages);
      res.send(userPackages);
    });

    // Get bookings by email (PRIVATE route)
    app.get('/bookings',verifyFirebaseToken,verifyTokenEmail, async (req, res) => {
      const email = req.query.email;
      const query = { buyerEmail: email };
      const result = await bookingCollection.find(query).toArray();

      for(const booking of result){
      const tourId = booking.tourId;
      const tourQuery = {_id: new ObjectId(tourId)}
      const tour = await packageCollection.findOne(tourQuery);
      booking.price = tour.price
      booking.tourName = tour.tourName
      booking.name = tour.name
      booking.contactNo = tour.contactNo
      booking.departureDate = tour.departureDate
      booking.departureLocation = tour.departureLocation
      }

      res.send(result);
    });

  






    // Create a new booking
    app.post('/bookings', async (req, res) => {
      try {
        const bookingData = req.body;
        console.log('Received Booking:', bookingData);
        const result = await bookingCollection.insertOne(bookingData);
        res.status(201).send({ success: true, message: 'Booking successful!', ...result });
      } catch (error) {
        console.error('Booking Error:', error);
        res.status(500).send({ success: false, message: 'Internal Server Error' });
      }
    });

    //update
    app.put('/packages/:id', async(req, res) =>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const options = {upsert: true}
      const updatedPackage = req.body;
      const updateDoc = {
        $set:updatedPackage
      }
      const result = await packageCollection.updateOne(filter, updateDoc, options);

      res.send(result);
    })

    //delete
    app.delete('/packages/:id', async(req, res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
        const result = await packageCollection.deleteOne(query);
        res.send(result)
      
    }) 
   

    // Ping to confirm DB connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Leave connection open for server use
  }
}

run().catch(console.dir);

// Root Route
app.get('/', (req, res) => {
  res.send('AtlasWay is cooking');
});

// Server Listener
app.listen(port, () => {
  console.log(`AtlasWay is running on port ${port}`);
});
