const express = require('express');
const app = express();
app.use(express.json());

let toolStatus = 'on'; // Default status

app.get('/tool-status', (req, res) => {
  res.json({ status: toolStatus });
});

// Simple security: require a secret key in the POST body
const SECRET = process.env.STATUS_SECRET || 'yoursecret';

app.post('/tool-status', (req, res) => {
  if (req.body.secret !== SECRET) return res.status(403).json({ error: 'Forbidden' });
  if (req.body.status === 'on' || req.body.status === 'off') {
    toolStatus = req.body.status;
    return res.json({ status: toolStatus });
  }
  res.status(400).json({ error: 'Invalid status' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Status API running on port ${PORT}`)); 