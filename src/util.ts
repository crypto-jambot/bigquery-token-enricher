import axios from "axios";
import IERC20 from "@openzeppelin/contracts/build/contracts/ERC20.json";
import { BigQueryUtil } from "@crypto-jambot/bigquery-utils";
import * as https from "https";

const projectId = process.env.PROJECT_ID;
const util = new BigQueryUtil({ projectId });
import { Web3Utils, AbiItem } from "@crypto-jambot/web3-utils";

type Token = { token_address: string };
type AddressObj = {
    address: string;
    name: string | null;
    symbol: string | null;
    decimals: number | null;
};
type RPCRequest = {
    jsonrpc: string;
    id: string;
    method: string;
    params: (string | { data: string; to: string })[];
};
type TokenSignature = {
    nameFn: string;
    symbolFn: string;
    decimalsFn: string;
};
type Response = {
    jsonrpc: string;
    id: string;
    result: string;
};

export async function queryTokens(
    blockchain: string,
    numberToProcess: number
): Promise<string[]> {
    const queryString = `SELECT * FROM \`crypto-351521.${getDataset(
        blockchain
    )}.tokens_awaiting_enrichment\` LIMIT ${numberToProcess}`;
    const rows = await util.query<Token>(queryString);
    return rows.map((row) => row.token_address);
}

export async function enrichTokens(
    utils: Web3Utils,
    tokens: string[],
    chunkSize: number
) {
    const { nameFn, symbolFn, decimalsFn } = await encodeFnSignatures(utils);
    const accessToken = await utils.getAccessToken();
    const addresses = tokens.map((address) => {
        return { address, name: null, symbol: null, decimals: null };
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
            return [...previous, ...next];
        });
    const responses = await makeChunkedRequest(
        requests,
        accessToken,
        chunkSize
    );
    return parseResponses(responses, addresses, utils);
}

function createRequest(
    identifier: number,
    symbolCharacter: string,
    functionType: string,
    address: AddressObj
): RPCRequest {
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

async function makeBatchRequest(
    requests: RPCRequest[],
    accessToken: string
): Promise<Response[]> {
    const config = {
        method: "post",
        url: process.env.JAM_ETH_NODE_HTTPS,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        maxBodyLength: Infinity,
        data: JSON.stringify(requests),
        httpsAgent: new https.Agent({ keepAlive: true }),
    };
    return (await axios(config)).data;
}

async function makeChunkedRequest(
    requests: RPCRequest[],
    accessToken: string,
    numChunks: number
): Promise<Promise<Response[]>> {
    let chunkStart = 0;
    let chunks: Promise<Response[]>[] = [];
    const constantSize = Math.floor(requests.length / numChunks);
    for (let i = 1; i <= numChunks; i++) {
        const previous = chunkStart;
        if (i === numChunks) {
            chunks = chunks.concat(
                makeBatchRequest(requests.slice(chunkStart), accessToken)
            );
            break;
        }
        chunkStart = constantSize + previous;
        chunks = chunks.concat(
            makeBatchRequest(requests.slice(previous, chunkStart), accessToken)
        );
    }
    return (await Promise.all(chunks)).reduce((previousValue, currentValue) => {
        return [...previousValue, ...currentValue];
    });
}

async function parseResponses(
    responses: Response[],
    addresses: AddressObj[],
    utils: Web3Utils
) {
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
                break;
            case "d":
                addresses[index].decimals = decimalHelper(utils, response);
                break;
        }
    });
    return addresses;
}

export function getDataset(blockchain: string) {
    switch (blockchain) {
        case "ethereum":
            return "ethereum_v2";
        default:
            return "ethereum_v2";
    }
}

async function encodeFnSignatures(utils: Web3Utils): Promise<TokenSignature> {
    const ethereum = await utils.getEthereum();
    const { abi } = ethereum;
    const { encodeFunctionSignature } = abi;
    return {
        nameFn: encodeFunctionSignature(
            IERC20.abi.filter((obj) => obj.name === "name")[0] as AbiItem
        ),
        symbolFn: encodeFunctionSignature(
            IERC20.abi.filter((obj) => obj.name === "symbol")[0] as AbiItem
        ),
        decimalsFn: encodeFunctionSignature(
            IERC20.abi.filter((obj) => obj.name === "decimals")[0] as AbiItem
        ),
    };
}

function nameSymbolHelper(
    { getUtilities }: Web3Utils,
    response: Response
): string | null {
    const { result } = response;
    const { hexToUtf8, stripHexPrefix } = getUtilities();
    const nameHex = stripHexPrefix(result).substring(128);
    return nameHex.length === 0
        ? hexToUtf8(result) || null
        : hexToUtf8("0x" + nameHex);
}

function decimalHelper(
    { getUtilities }: Web3Utils,
    response: Response
): number | null {
    const { result } = response;
    const { hexToNumberString, hexToNumber } = getUtilities();
    return hexToNumberString(result).length > 2 ? null : hexToNumber(result);
}

export function getResponse(message: string) {
    return {
        success: true,
        message,
    };
}
