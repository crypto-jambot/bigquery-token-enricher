import {
    queryTokens,
    encodeFnSignatures,
    enrichTokens,
    initializeWeb3,
    load,
} from "./util.js";

export const main = async (requestBody) => {
    const {
        blockchain,
        numberToProcess = 50000,
        rpcBatchSize = 25000,
    } = requestBody;
    const [web3, accessToken] = await initializeWeb3();
    const tokens = await queryTokens(blockchain, numberToProcess);

    if (tokens.length == 0) {
        return {
            success: true,
            message: `No tokens to enrich. All tokens on the ${blockchain} blockchain are fully enriched.`,
        };
    }

    const { nameFn, symbolFn, decimalsFn } = encodeFnSignatures(web3);

    const enrichedTokens = await enrichTokens(
        web3,
        nameFn,
        symbolFn,
        decimalsFn,
        tokens,
        rpcBatchSize,
        accessToken
    );

    await load(blockchain, enrichedTokens);

    return {
        success: true,
        message: `Operation Successful. Enriched ${enrichedTokens.length} tokens.`,
    };
};
