import { queryTokens, enrichTokens, getDataset, getResponse } from "./util";
import { Web3Utils } from "@crypto-jambot/web3-utils";
import { BigQueryUtil } from "@crypto-jambot/bigquery-utils";
import { SecretUtil } from "@crypto-jambot/secret-manager-utils";

const util = new BigQueryUtil();
const secretUtil = new SecretUtil();
type RequestBody = {
    blockchain: string;
    numberToProcess?: number;
    chunkSize?: number;
};
export const main = async (requestBody: RequestBody) => {
    const { blockchain, numberToProcess = 50000, chunkSize = 1 } = requestBody;
    const apiKey = await secretUtil.getSecretString(
        process.env.API_SECRET_KEY as string
    );
    const utils = new Web3Utils(apiKey);
    const tokens = await queryTokens(blockchain, numberToProcess);
    if (tokens.length === 0) {
        return getResponse(
            `No tokens to enrich. All tokens on the ${blockchain} blockchain are fully enriched.`
        );
    }
    const enrichedTokens = await enrichTokens(utils, tokens, chunkSize);
    await util.insert({
        table: "tokens",
        data: enrichedTokens,
        dataset: getDataset(blockchain),
    });
    return getResponse(
        `Operation Successful. Enriched ${enrichedTokens.length} tokens.`
    );
};
