require('dotenv').config();
const express = require('express');
const app = express();
const indexRouter = require('./routes/routes.js');


const PORT = process.env.PORT || 8000;

app.use('/',indexRouter)

app.use((req, res) => {
    res.status(404).json({"error":"Error 404"});
});


app.listen(PORT, () => { console.log('Listening on port ', PORT); });


