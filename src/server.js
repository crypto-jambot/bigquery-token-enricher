import "dotenv/config";
import express from "express";
import { main } from "./index.js";

const app = express();
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.post("/", async (req, res) => {
    let start = new Date();
    console.log(
        `Start Time is: ${start.toLocaleString("en-US", { timeZone: "CST" })}`
    );

    const result = await main(req.body);

    let end = new Date();
    console.log(
        `End Time is: ${end.toLocaleString("en-US", { timeZone: "CST" })}`
    );
    console.log(`Time taken: ${(end - start) / 1000} seconds`);
    console.log(result);

    res.json(result);
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`bigquery-token-enricher: listening on port ${PORT}`);
});
