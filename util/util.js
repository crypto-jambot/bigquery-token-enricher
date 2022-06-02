const queryTokens = async (bigQuery, numberToProcess) => {
    const query = `WITH unique_tokens AS (
            WITH token0Address AS (
            SELECT DISTINCT u.token0Address token_address FROM \`crypto-351521.ethereum.uniswap_v2_pair_addresses\` u
            UNION DISTINCT
            SELECT s.token0Address FROM \`crypto-351521.ethereum.sushiswap_v2_pair_addresses\` s
            ),
            token1Address AS (
            SELECT DISTINCT u.token1Address FROM \`crypto-351521.ethereum.uniswap_v2_pair_addresses\` u
            UNION DISTINCT
            SELECT s.token1Address FROM \`crypto-351521.ethereum.sushiswap_v2_pair_addresses\` s
            )
        
            SELECT * FROM token0Address
            UNION DISTINCT
            SELECT * FROM token1Address
        )
        
        SELECT unique_tokens.token_address
        FROM unique_tokens
        EXCEPT DISTINCT
            SELECT address
            FROM \`crypto-351521.ethereum.erc20_tokens\`
        LIMIT ${numberToProcess}`;

    // For all options, see https://cloud.google.com/bigquery/docs/reference/rest/v2/jobs/query
    const options = {
        query: query,
        // Location must match that of the dataset(s) referenced in the query.
        location: 'US',
    };

    // Run the query as a job
    const [ job ] = await bigQuery.createQueryJob(options);
    console.log(`Job ${job.id} started.`);

    // Wait for the query to finish
    const [ rows ] = await job.getQueryResults();
    
    return rows.map(row => row.token_address);
}

const enrichTokens = async (tokenContracts) => {
    console.log("Fetching token info.");
    const enrichedTokens = [];
    for (tokenContract of tokenContracts) {
        enrichedTokens.push(enrichToken(tokenContract));
    }
    return Promise.all(enrichedTokens);
}

const enrichTokensSync = async (tokenContracts, logFrequency) => {
    console.log("Fetching token info.");
    const enrichedTokens = [];
    for (let i = 0; i < tokenContracts.length; i++) {
        if (i != 0 && i % logFrequency == 0) {
            console.log(`Completed enriching ${i} tokens so far... total left is ${tokenContracts.length - (i)}.`);
        }
        enrichedTokens.push(await enrichToken(tokenContracts[i]));
    }
    return enrichedTokens;
}

const enrichToken = async (tokenContract) => {
    return {
        name: await getTokenName(tokenContract),
        symbol: await getTokenSymbol(tokenContract),
        address: tokenContract._address,
        decimals: await getTokenDecimals(tokenContract)
    }
}

const getTokenName = async (tokenContract) => {
    let name = null;
    try {
        name = await tokenContract.methods.name().call();
    } finally {
        return name;
    }
}

const getTokenSymbol = async (tokenContract) => {
    let symbol = null;
    try {
        symbol = await tokenContract.methods.symbol().call();
    } finally {
        return symbol;
    }
}

const getTokenDecimals = async (tokenContract) => {
    let decimals = null;
    try {
        decimals = await tokenContract.methods.decimals().call();
    } finally {
        return decimals;
    }
}

module.exports = {
    queryTokens,
    enrichTokens,
    enrichTokensSync
}