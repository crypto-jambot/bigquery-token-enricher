# bigquery-token-enricher

This repository enriches ERC20 Tokens that exists in liquidity pool data on an ad hoc basis.

## How to use it

This application is a Cloud Run API that executes when you make a POST call to "/" and give it the following:

Your request body must be an object:

```
{
    "blockchain": "ethereum",
    "numberToProcess": 10000, 
    "chunkSize": 3
}
```

Arguments:

-   blockchain - The blockchain the exchange lives on.
-   numberToProcess - The number of ERC20 tokens to enrich in this iteration. This is optional and the default is 50000.
-   chunkSize - The number of requests that get sent to the ethereum node. This is optional and the default is 1.

The response will be an object:

```
{
    "success": true,
    "message": "Operation Successful. Enriched 1000 tokens."
}
```

## How it works

When you send a request to the endpoint, the main method will be executed and do the following:

1. Initialize our web3-utils class. This has all the logic we need for this application to it's job.
2. Call BQ for a list of tokens that need to be enriched. (Limited based on the "numberToProcess" variable)
3. Encode the function signatures from the ERC20 ABI that we are interested in. (name, symbol, and decimals) #Planning to move this logic to the web3-utils
4. Run through each token address return from BigQuery, building an array of JSON RPC objects.
5. Based on the number of chunks the requests are broken up into n arrays. Each array is then sent as batched request. Once all requests are done the arrays are merged.
6. Once we get an array of responses we parse through them and combine with original array to avoid double iterating.
7. Insert list of tokens into BQ

## External Dependencies

This API is intended to work only if the following infrastructure is in place

-   A dataset in BQ for the blockchain in question and a table inside that dataset called <code>tokens</code>
-   A view inside the same dataset called <code>tokens_awaiting_enrichment</code>
