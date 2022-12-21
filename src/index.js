import { queryTokens, enrichTokens, getDataset, getResponse } from "./util.js";
import { Web3Utils } from "@crypto-jambot/web3-utils";
import { BigQueryUtil } from "@crypto-jambot/bigquery-utils";
import { SecretUtil } from "@crypto-jambot/secret-manager-utils";

const projectId = process.env.PROJECT_ID;
const { insert } = new BigQueryUtil({ projectId });
const secretUtil = new SecretUtil({ projectId });
export const main = async (requestBody) => {
    const { blockchain, numberToProcess = 50000, chunkSize = 1 } = requestBody;
    const apiKey = await secretUtil.getSecretString(process.env.API_SECRET_KEY);
    const utils = new Web3Utils(apiKey);
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
