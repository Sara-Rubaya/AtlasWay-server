require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// Firebase Admin setup
const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8');
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(decoded)) });

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'https://atlasway-client.web.app'],
  credentials: true
}));
app.use(express.json());

// NeonDB connection (connection string .env e DATABASE_URL hisebe rakho)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Neon-e SSL lagbe
});

// ---------- Auth middlewares ----------
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).send({ message: 'Unauthorized access: No token or bad format' });
  }
  try {
    req.decoded = await admin.auth().verifyIdToken(authHeader.split(' ')[1]);
    next();
  } catch (error) {
    return res.status(401).send({ message: 'Unauthorized access: Token invalid' });
  }
};

const verifyTokenEmail = (req, res, next) => {
  if (req.query.email !== req.decoded.email) {
    return res.status(403).send({ message: 'forbidden access' });
  }
  next();
};

// ---------- Helper: row ke flatten kore pathabo (data jsonb + top-level fields) ----------
const flattenPackage = (row) => ({
  _id: row.id,
  tourName: row.tour_name,
  name: row.name,
  price: row.price,
  contactNo: row.contact_no,
  departureDate: row.departure_date,
  departureLocation: row.departure_location,
  email: row.email,
  ...row.data
});

// ---------- Routes ----------

app.get('/', (req, res) => res.send('AtlasWay is cooking'));

// Get all packages
app.get('/packages', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM packages ORDER BY id DESC');
  res.send(rows.map(flattenPackage));
});

// Add a new package
app.post('/add-package', async (req, res) => {
  const { tourName, name, price, contactNo, departureDate, departureLocation, email, ...rest } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO packages (tour_name, name, price, contact_no, departure_date, departure_location, email, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [tourName, name, price, contactNo, departureDate, departureLocation, email, rest]
  );
  res.status(201).send({ insertedId: rows[0].id, message: 'data paisi' });
});

// Get single package by ID
app.get('/package/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM packages WHERE id = $1', [req.params.id]);
  res.send(rows[0] ? flattenPackage(rows[0]) : null);
});

// Get all packages by user's email
app.get('/my-packages/:email', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM packages WHERE email = $1', [req.params.email]);
  res.send(rows.map(flattenPackage));
});

// Get bookings by email (PRIVATE route)
app.get('/bookings', verifyFirebaseToken, verifyTokenEmail, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.*, p.tour_name, p.name, p.price, p.contact_no, p.departure_date, p.departure_location
     FROM bookings b
     JOIN packages p ON p.id = b.tour_id
     WHERE b.buyer_email = $1`,
    [req.query.email]
  );
  const result = rows.map(r => ({
    _id: r.id,
    tourId: r.tour_id,
    buyerEmail: r.buyer_email,
    ...r.data,
    price: r.price,
    tourName: r.tour_name,
    name: r.name,
    contactNo: r.contact_no,
    departureDate: r.departure_date,
    departureLocation: r.departure_location
  }));
  res.send(result);
});

// Create a new booking
app.post('/bookings', async (req, res) => {
  try {
    const { tourId, buyerEmail, ...rest } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO bookings (tour_id, buyer_email, data) VALUES ($1,$2,$3) RETURNING id',
      [tourId, buyerEmail, rest]
    );
    res.status(201).send({ success: true, message: 'Booking successful!', insertedId: rows[0].id });
  } catch (error) {
    console.error('Booking Error:', error);
    res.status(500).send({ success: false, message: 'Internal Server Error' });
  }
});

// Confirm a booking (status change)
app.patch('/bookings/:id', async (req, res) => {
  const { rowCount } = await pool.query(
    `UPDATE bookings SET data = jsonb_set(coalesce(data, '{}'::jsonb), '{status}', '"completed"') WHERE id = $1`,
    [req.params.id]
  );
  res.send({ success: rowCount > 0, modifiedCount: rowCount });
});

// Update a package
app.put('/packages/:id', async (req, res) => {
  const { tourName, name, price, contactNo, departureDate, departureLocation, email, ...rest } = req.body;
  const { rowCount } = await pool.query(
    `UPDATE packages SET tour_name=$1, name=$2, price=$3, contact_no=$4,
     departure_date=$5, departure_location=$6, email=$7, data=$8 WHERE id=$9`,
    [tourName, name, price, contactNo, departureDate, departureLocation, email, rest, req.params.id]
  );
  res.send({ modifiedCount: rowCount });
});
// Confirm a booking (status change)
app.patch('/bookings/:id', async (req, res) => {
  const { rowCount } = await pool.query(
    `UPDATE bookings SET data = jsonb_set(coalesce(data, '{}'::jsonb), '{status}', '"completed"') WHERE id = $1`,
    [req.params.id]
  );
  res.send({ success: rowCount > 0, modifiedCount: rowCount });
});

// Delete a package
app.delete('/packages/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM packages WHERE id = $1', [req.params.id]);
  res.send({ deletedCount: rowCount });
});

app.listen(port, () => console.log(`AtlasWay is running on port ${port}`));