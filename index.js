require("dotenv").config();
const fs = require('fs');
const { web3 } = require('./setup');
const { BigQuery } = require("@google-cloud/bigquery");
const IERC20 = require('@openzeppelin/contracts/build/contracts/ERC20.json');
const settings = require('./config/settings.json');
const { queryTokens, enrichTokens, enrichTokensSync } = require('./util/util');
const erc20TokenSchema = require('./schemas/erc20_tokens_schema.json');

const main = async () => {

    // Start Timer
    let start = new Date();
    console.log(`Start Time is: ${start}`);

    // Query BigQuery for tokens to enrich
    const bigQuery = new BigQuery();

    console.log("Fetching Tokens from BigQuery to enrich...")
    const tokens = await queryTokens(bigQuery, settings.numberToProcess);
    const tokenContracts = tokens.map((token) => {
        return new web3.eth.Contract(IERC20.abi, token);
    })
    
    let enrichedTokens;
    // If processing synchronously, get and enrich tokens one by one.
    if (!settings.processAsynchronously) {
        enrichedTokens = await enrichTokensSync(tokenContracts, settings.synchronousLogFrequently);
    } else {
        // Must use Infura when process asynchronously.
        if (settings.nodeProvider != "INFURA") {
            console.error("Usage: Must use Infura as a node provider in order to process asynchronously.");
            process.exit(1);
        }
        enrichedTokens = await enrichTokens(tokenContracts);
    }
    
    const output = enrichedTokens.map((enrichedToken) => {
        return `${JSON.stringify(enrichedToken)}\n`
    });

    let end = new Date();
    console.log(`End Time is: ${end}`);
    console.log(`Time taken: ${(end - start)/1000} seconds`);
    
    if (settings.saveLocalFile) {
        console.log("Writing to file.");
        
        if (!settings.appendToFile) {
            if (fs.existsSync(settings.outputFilepath)) {
                fs.unlinkSync(settings.outputFilepath);
            }
        }
        for (line of output) {
            fs.appendFileSync(settings.outputFilepath, line);
        }
        console.log("JSON file has been saved.");
    }

    if (settings.uploadToBigQuery) {
        console.log("Uploading to BigQuery");

        const filepath = "./tempdata.jsonl";
        const datasetId = settings.blockchain;
        const tableId = settings.tableId;
        
        for (line of output) {
            fs.appendFileSync(filepath, line);
        }
        // set metadata
        const metadata = {
            sourceFormat: 'NEWLINE_DELIMITED_JSON',
            schema: {
                fields: erc20TokenSchema
            }
        };

        // Load data from a local file into the table
        const [job] = await bigQuery
            .dataset(datasetId)
            .table(tableId)
            .load(filepath, metadata);

        console.log(`Job ${job.id} completed.`);

        // Clean up tempFile
        fs.unlinkSync(filepath);

        // Check the job's status for errors
        const errors = job.status.errors;
        if (errors && errors.length > 0) {
            throw errors;
        }
    }
    process.exit(0);
}

main();