/*********************************************************************
 * Copyright (C) 2022 Joshua Sells joshuataylorsells@gmail.com
 *
 * Unauthorized copying of this file, via any medium is strictly prohibited
 *
 * Proprietary and confidential
 *
 *********************************************************************/

import 'dotenv/config';
import fs from 'fs';
import { web3 } from './setup/setup';
import { BigQuery } from '@google-cloud/bigquery';
import settings from './config/settings.json';
import * as Constants from './constants/constants';
import IERC20 from '@openzeppelin/contracts/build/contracts/ERC20.json';
import { queryTokens, enrichTokens, enrichTokensSync } from './util/util';
import erc20TokenSchema from './resources/schemas/erc20_tokens_schema.json';

export const main = async (numberToProcess) => {
    let result;
    // Start Timer
    let start = new Date();
    console.log(`Start Time is: ${start}`);
    console.log('Fetching Tokens from BigQuery to enrich...');
    const tokens = await queryTokens(numberToProcess);

    if (tokens.length == 0) {
        result = {
            status: 200,
            message: 'No tokens to enrich. Table is fully updated.',
        };
        console.log(result);
        return result;
    }

    const tokenContracts = tokens.map((token) => {
        return new web3.eth.Contract(IERC20.abi, token);
    });

    let enrichedTokens;
    // If processing synchronously, get and enrich tokens one by one.
    if (!settings.processAsynchronously) {
        enrichedTokens = await enrichTokensSync(tokenContracts, settings.synchronousLogFrequently);
    } else {
        // Must use Infura when process asynchronously.
        if (settings.nodeProvider != Constants.INFURA) {
            result = {
                status: 500,
                message:
                    'Usage: Must use Infura as a node provider in order to process asynchronously.',
            };
            console.log(result);
            return result;
        }
        enrichedTokens = await enrichTokens(tokenContracts);
    }

    const output = enrichedTokens.map((enrichedToken) => {
        return `${JSON.stringify(enrichedToken)}\n`;
    });

    let end = new Date();
    console.log(`End Time is: ${end}`);
    console.log(`Time taken: ${(end - start) / 1000} seconds`);

    if (settings.saveLocalFile) {
        console.log('Writing to file.');

        if (!settings.appendToFile) {
            if (fs.existsSync(settings.outputFilepath)) {
                fs.unlinkSync(settings.outputFilepath);
            }
        }
        for (const line of output) {
            fs.appendFileSync(settings.outputFilepath, line);
        }
        console.log('JSON file has been saved.');
    }

    if (settings.uploadToBigQuery) {
        console.log('Uploading to BigQuery');

        const bigQuery = new BigQuery();
        const filepath = Constants.TEMP_FILE_PATH;
        const datasetId = settings.bqDataset;
        const tableId = settings.bqTable;

        for (const line of output) {
            fs.appendFileSync(filepath, line);
        }
        // set metadata
        const metadata = {
            sourceFormat: Constants.JSONL,
            schema: {
                fields: erc20TokenSchema,
            },
        };

        // Load data from a local file into the table
        const [job] = await bigQuery.dataset(datasetId).table(tableId).load(filepath, metadata);

        console.log(`Job ${job.id} completed.`);

        // Clean up tempFile
        fs.unlinkSync(filepath);

        // Check the job's status for errors
        const errors = job.status.errors;
        if (errors && errors.length > 0) {
            throw errors;
        }
    }
    result = {
        status: 200,
        message: `Operation Successful. Enriched ${output.length} tokens and inserted into the table: ${settings.bqTable}.`,
    };
    console.log(result);
    return result;
};
