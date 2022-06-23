/*********************************************************************
 * Copyright (C) 2022 Joshua Sells joshuataylorsells@gmail.com
 *
 * Unauthorized copying of this file, via any medium is strictly prohibited
 *
 * Proprietary and confidential
 *
 *********************************************************************/

import settings from '../config/settings.json';
import { BigQuery } from '@google-cloud/bigquery';

export const queryTokens = async (numberToProcess) => {
    const queryString = `SELECT * FROM \`crypto-351521.ethereum.tokens_awaiting_enrichment\` LIMIT ${numberToProcess}`;
    const rows = await query(queryString);
    // Flatten Array of objects to Array of strings and return.
    return rows.map((row) => row.token_address);
};

export const enrichTokens = async (tokenContracts) => {
    console.log('Fetching token info.');
    const enrichedTokens = [];
    for (const tokenContract of tokenContracts) {
        enrichedTokens.push(enrichToken(tokenContract));
    }
    return Promise.all(enrichedTokens);
};

export const enrichTokensSync = async (tokenContracts, logFrequency) => {
    console.log('Fetching token info.');
    const enrichedTokens = [];
    for (let i = 0; i < tokenContracts.length; i++) {
        if (i != 0 && i % logFrequency == 0) {
            console.log(
                `Completed enriching ${i} tokens so far... total left is ${
                    tokenContracts.length - i
                }.`
            );
        }
        enrichedTokens.push(await enrichToken(tokenContracts[i]));
    }
    return enrichedTokens;
};

const query = async (queryString) => {
    const bigQuery = new BigQuery();
    const options = {
        query: queryString,
        location: 'US',
    };
    const [job] = await bigQuery.createQueryJob(options);
    const [rows] = await job.getQueryResults();
    return rows;
};

const enrichToken = async (tokenContract) => {
    return {
        name: await getTokenName(tokenContract),
        symbol: await getTokenSymbol(tokenContract),
        address: tokenContract._address,
        decimals: await getTokenDecimals(tokenContract),
    };
};

const getTokenName = async (tokenContract) => {
    let name = null;
    try {
        name = await tokenContract.methods.name().call();
    } finally {
        return name;
    }
};

const getTokenSymbol = async (tokenContract) => {
    let symbol = null;
    try {
        symbol = await tokenContract.methods.symbol().call();
    } finally {
        return symbol;
    }
};

const getTokenDecimals = async (tokenContract) => {
    let decimals = null;
    try {
        decimals = await tokenContract.methods.decimals().call();
    } finally {
        return decimals;
    }
};
