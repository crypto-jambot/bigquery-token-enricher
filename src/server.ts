import "dotenv/config";
import express, { Request, Response } from "express";
import { main } from "./index";

const app = express();
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.post("/", async (req: Request, res: Response) => {
    const result = await main(req.body);
    res.json(result);
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`bigquery-token-enricher: listening on port ${PORT}`);
});
