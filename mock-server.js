const express = require('express');
     const app = express();
     app.use(express.json());

     // Endpoint to receive messages
     app.post('/message', (req, res) => {
         const { body, author, chatId } = req.body;
         console.log(`Received message: "${body}" from ${author} in ${chatId}`);
         res.status(200).send('Message received');
     });

     // Start the server
     const PORT = 3000;
     app.listen(PORT, () => {
         console.log(`Mock WhatsApp server running on http://localhost:${PORT}`);
     });