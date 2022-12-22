import axios from "axios";
import IERC20 from "@openzeppelin/contracts/build/contracts/ERC20.json" assert { type: "json" };
import { BigQueryUtil } from "@crypto-jambot/bigquery-utils";

const projectId = process.env.PROJECT_ID;
const { query } = new BigQueryUtil({ projectId });

export const queryTokens = async (blockchain, numberToProcess) => {
    const queryString = `SELECT * FROM \`crypto-351521.${getDataset(
        blockchain
    )}.tokens_awaiting_enrichment\` LIMIT ${numberToProcess}`;
    const rows = await query(queryString);
    // Flatten Array of objects to Array of strings and return.
    return rows.map((row) => row.token_address);
};

export const enrichTokens = async (utils, tokens, chunkSize) => {
    const { nameFn, symbolFn, decimalsFn } = await encodeFnSignatures(utils);
    const accessToken = await utils.getAccessToken();
    const addresses = tokens.map((address) => {
        return { address };
    });

    const requests = addresses
        .map((address, index) => {
            return [
                createRequest(index, "n", nameFn, address),
                createRequest(index, "s", symbolFn, address),
                createRequest(index, "d", decimalsFn, address),
            ];
        })
        .reduce((previous, next) => {
            if (!previous) return;
            return [...previous, ...next];
        });
    const responses = await makeChunkedRequest(
        requests,
        accessToken,
        chunkSize
    );
    return parseResponses(responses, addresses, utils);
};

function createRequest(identifier, symbolCharacter, functionType, address) {
    const { address: value } = address;
    return {
        jsonrpc: "2.0",
        id: `${identifier}${symbolCharacter}`,
        method: "eth_call",
        params: [
            {
                data: functionType,
                to: value,
            },
            "latest",
        ],
    };
}

async function makeBatchRequest(requests, accessToken) {
    const config = {
        method: "post",
        url: process.env.JAM_ETH_NODE_HTTPS,
        headers: {
            "access-token": accessToken,
            "Content-Type": "application/json",
        },
        maxBodyLength: Infinity,
        data: JSON.stringify(requests),
    };
    return (await axios(config)).data;
}

async function makeChunkedRequest(requests, accessToken, numChunks) {
    let chunkStart = 0;
    let chunks = [];
    const constantSize = Math.floor(requests.length / numChunks);
    for (let i = 1; i <= numChunks; i++) {
        const previous = chunkStart;
        if (i === numChunks) {
            chunks = chunks.concat(
                await makeBatchRequest(requests.slice(chunkStart), accessToken)
            );
            break;
        }
        chunkStart = constantSize + previous;
        chunks = chunks.concat(
            await makeBatchRequest(
                requests.slice(previous, chunkStart),
                accessToken
            )
        );
    }
    return chunks;
}

async function parseResponses(responses, addresses, utils) {
    responses.forEach((response) => {
        const { result, id } = response;
        if (!result || result === "0x") return;
        const index = parseInt([...id].slice(0, -1).join(""));
        const type = id.slice(-1);
        switch (type) {
            case "n":
                addresses[index].name = nameSymbolHelper(utils, response);
                break;
            case "s":
                addresses[index].symbol = nameSymbolHelper(utils, response);
            case "d":
                addresses[index].decimals = decimalHelper(utils, response);
        }
    });
    return addresses;
}

export function getDataset(blockchain) {
    switch (blockchain) {
        case "ethereum":
            return "ethereum_v2";
        default:
            return "ethereum_v2";
    }
}

async function encodeFnSignatures(utils) {
    const ethereum = await utils.getEthereum();
    const { abi } = ethereum;
    const { encodeFunctionSignature } = abi;
    return {
        nameFn: encodeFunctionSignature(
            IERC20.abi.filter((obj) => obj.name === "name")[0]
        ),
        symbolFn: encodeFunctionSignature(
            IERC20.abi.filter((obj) => obj.name === "symbol")[0]
        ),
        decimalsFn: encodeFunctionSignature(
            IERC20.abi.filter((obj) => obj.name === "decimals")[0]
        ),
    };
}

function nameSymbolHelper({ getUtilities }, response) {
    const { result } = response;
    const { hexToUtf8, stripHexPrefix } = getUtilities();
    const nameHex = stripHexPrefix(result).substring(128);
    return nameHex.length === 0
        ? hexToUtf8(result) || null
        : hexToUtf8("0x" + nameHex);
}

function decimalHelper({ getUtilities }, response) {
    const { result } = response;
    const { hexToNumberString, hexToNumber } = getUtilities();
    return hexToNumberString(result).length > 2 ? null : hexToNumber(result);
}

export function getResponse(message) {
    return {
        success: true,
        message,
    };
}
