require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const typeRoutes = require('./routes/typeRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const companyRoutes = require('./routes/companyRoutes');
const locationRoutes = require('./routes/locationRoutes');
const notificationEmailRoutes = require('./routes/notificationEmailRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/types', typeRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/notification-emails', notificationEmailRoutes);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('ℹ️  Reminders are triggered externally via POST /api/items/run-reminders');
    });
  })
  .catch(err => console.log('MongoDB connection error:', err));