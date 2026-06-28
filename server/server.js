require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Import routes
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const typeRoutes = require('./routes/typeRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const companyRoutes = require('./routes/companyRoutes');
const locationRoutes = require('./routes/locationRoutes');
const notificationEmailRoutes = require('./routes/notificationEmailRoutes');

// Import scheduler (make sure the file exists)
const { startScheduler } = require('./utils/scheduler');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/types', typeRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/notification-emails', notificationEmailRoutes);

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(5000, () => console.log('Server running on port 5000'));
    startScheduler();   // Start the daily email job (if you have it)
  })
  .catch(err => console.log('MongoDB connection error:', err));