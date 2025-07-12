fetch('https://backend-server-trhh.onrender.com/api/validate-key', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'testkey', username: 'testuser' })
})
  .then(res => res.text())
  .then(text => console.log('Response:', text))
  .catch(err => console.error('Error:', err));