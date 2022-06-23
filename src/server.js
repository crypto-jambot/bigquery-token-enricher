/*********************************************************************
 * Copyright (C) 2022 Joshua Sells joshuataylorsells@gmail.com
 *
 * Unauthorized copying of this file, via any medium is strictly prohibited
 *
 * Proprietary and confidential
 *
 *********************************************************************/

import 'dotenv/config';
import express from 'express';
import { main } from './index';

const app = express();
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.post('/', async (req, res) => {
    const numberToProcess = req.body.numberToProcess;
    let result = await main(numberToProcess);
    res.status(result.status).send(result.message);
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`bigquery-token-enricher: listening on port ${PORT}`);
});
