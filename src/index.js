import { queryTokens, enrichTokens, getDataset, getResponse } from "./util.js";
import { Web3Utils } from "@crypto-jambot/web3-utils";
import { BigQueryUtil } from "@crypto-jambot/bigquery-utils";
import { PROJECT_ID as projectId } from "./constants.js";

const { insert } = new BigQueryUtil({ projectId });
export const main = async (requestBody) => {
    const { blockchain, numberToProcess = 50000, chunkSize = 1 } = requestBody;
    const utils = new Web3Utils(process.env.API_KEY);
    const tokens = await queryTokens(blockchain, numberToProcess);
    if (tokens.length === 0) {
        return getResponse(
            `No tokens to enrich. All tokens on the ${blockchain} blockchain are fully enriched.`
        );
    }
    const enrichedTokens = await enrichTokens(utils, tokens, chunkSize);
    await insert({
        table: "tokens",
        data: enrichedTokens,
        dataset: getDataset(blockchain),
    });
    return getResponse(
        `Operation Successful. Enriched ${enrichedTokens.length} tokens.`
    );
};
