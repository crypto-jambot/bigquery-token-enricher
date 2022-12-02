# bigquery-token-enricher

This repository enriches ERC20 Tokens that exists in liquidity pool data on an ad hoc basis.

## How to use it

This application is a Cloud Run API that executes when you make a POST call to "/" and give it the following:

Your request body must be an object:

```
{
    "blockchain": "ethereum",
    "numberToProcess": 10000,
    "rpcBatchSize": 1000
}
```

Arguments:

-   blockchain - The blockchain the exchange lives on.
-   numberToProcess - The number of ERC20 tokens to enrich in this iteration. This is optional and the default is 50000.
-   rpcBatchSize - The size of batch requests that get sent to the blockchain node. This is optional and the default is 25000.

The response will be an object:

```
{
    "success": true,
    "message": "Operation Successful. Enriched 1000 tokens."
}
```

## How it works

When you send a request to the endpoint, the main method will be executed and do the following:

1. Initialize a web3 http connection to a node
2. Call BQ for a list of tokens that need to be enriched. (Limited based on the "numberToProcess" variable)
3. Encode the function signatures from the ERC20 ABI that we are interested in. (name, symbol, and decimals)
4. Run through each token address return from BigQuery, building an array of JSON RPC objects.
5. Every n iterations, based on the rpcBatchSize variable, send a batch call to the node and map the results back to the enrichedTokens array.
6. Insert the enriched tokens into BQ

## External Dependencies

This API is intended to work only if the following infrustructure is in place

-   A dataset in BQ for the blockchain in question and a table inside that dataset called <code>tokens</code>
-   A view inside the same dataset called <code>tokens_awaiting_enrichment</code>
