import * as Constants from "./constants.js";

import Web3 from "web3";
import Web3HttpProvider from "web3-providers-http";
import axios from "axios";
import { BigQuery } from "@google-cloud/bigquery";
import IERC20 from "@openzeppelin/contracts/build/contracts/ERC20.json" assert { type: "json" };

const bigQuery = new BigQuery();

export const queryTokens = async (blockchain, numberToProcess) => {
    let dataset;
    switch (blockchain) {
        case "ethereum":
            dataset = "ethereum_v2";
            break;
        default:
            dataset = "ethereum_v2";
    }
    const queryString = `SELECT * FROM \`crypto-351521.${dataset}.tokens_awaiting_enrichment\` LIMIT ${numberToProcess}`;
    const rows = await query(queryString);
    // Flatten Array of objects to Array of strings and return.
    return rows.map((row) => row.token_address);
};

export const enrichTokens = async (
    web3,
    nameFn,
    symbolFn,
    decimalsFn,
    tokens,
    rpcBatchSize,
    accessToken
) => {
    let enrichedTokens = [];
    for (let i = 0; i < tokens.length; i++) {
        enrichedTokens[i] = {
            address: tokens[i],
        };
    }

    let requests = [];
    for (let i = 1; i <= tokens.length; i++) {
        // build request and push to array
        requests.push({
            jsonrpc: "2.0",
            id: `${i - 1}n`,
            method: "eth_call",
            params: [
                {
                    data: nameFn,
                    to: tokens[i - 1],
                },
                "latest",
            ],
        });
        requests.push({
            jsonrpc: "2.0",
            id: `${i - 1}s`,
            method: "eth_call",
            params: [
                {
                    data: symbolFn,
                    to: tokens[i - 1],
                },
                "latest",
            ],
        });
        requests.push({
            jsonrpc: "2.0",
            id: `${i - 1}d`,
            method: "eth_call",
            params: [
                {
                    data: decimalsFn,
                    to: tokens[i - 1],
                },
                "latest",
            ],
        });

        // every n iterations, we send a batch call and populate the enrichedTokens array according to the mapped id value
        if (i % rpcBatchSize === 0 || i === tokens.length) {
            // send call
            const config = {
                method: "post",
                url: Constants.JAM_ETH_NODE_HTTPS,
                headers: {
                    "access-token": accessToken,
                    "Content-Type": "application/json",
                },
                maxBodyLength: Infinity,
                data: JSON.stringify(requests),
            };
            const response = await axios(config);

            response.data.forEach((obj) => {
                const { result } = obj;
                if (!result || result === "0x") return;
                let index = parseInt(obj.id.substring(0, obj.id.length - 1));
                let type = obj.id.slice(-1);
                const {
                    hexToUtf8,
                    stripHexPrefix,
                    hexToNumber,
                    hexToNumberString,
                } = web3.utils;
                const nameHex = stripHexPrefix(result).substring(128);
                const invalid = nameHex.length === 0;

                switch (type) {
                    case "n":
                        invalid
                            ? (enrichedTokens[index].name =
                                  hexToUtf8(result) || null)
                            : (enrichedTokens[index].name = hexToUtf8(
                                  "0x" + nameHex
                              ));
                        break;
                    case "s":
                        invalid
                            ? (enrichedTokens[index].symbol =
                                  hexToUtf8(result) || null)
                            : (enrichedTokens[index].symbol = hexToUtf8(
                                  "0x" + nameHex
                              ));
                        break;
                    case "d":
                        hexToNumberString(result).length > 2
                            ? (enrichedTokens[index].decimals = null)
                            : (enrichedTokens[index].decimals =
                                  hexToNumber(result));
                }
            });
            // clear buffer
            requests = [];
        }
    }
    return enrichedTokens;
};

export const initializeWeb3 = async () => {
    const getAccessToken = async () => {
        const config = {
            method: "get",
            url: Constants.JAM_ETH_NODE_AUTH,
            headers: {
                "api-key": process.env.API_KEY,
            },
        };
        const response = await axios(config);
        return response.data.token;
    };

    const { token } = await getAccessToken();
    const options = {
        headers: [
            {
                name: "access-token",
                value: token,
            },
        ],
    };

    return [
        new Web3(new Web3HttpProvider(Constants.JAM_ETH_NODE_HTTPS, options)),
        token,
    ];
};

export const load = async (blockchain, data) => {
    let dataset;
    switch (blockchain) {
        case "ethereum":
            dataset = "ethereum_v2";
            break;
        default:
            dataset = "ethereum_v2";
    }
    await bigQuery.dataset(dataset).table("tokens").insert(data);
};

export const encodeFnSignatures = (web3) => {
    return {
        nameFn: web3.eth.abi.encodeFunctionSignature(
            IERC20.abi.filter((obj) => obj.name === "name")[0]
        ),
        symbolFn: web3.eth.abi.encodeFunctionSignature(
            IERC20.abi.filter((obj) => obj.name === "symbol")[0]
        ),
        decimalsFn: web3.eth.abi.encodeFunctionSignature(
            IERC20.abi.filter((obj) => obj.name === "decimals")[0]
        ),
    };
};

const query = async (queryString) => {
    const options = {
        query: queryString,
        location: "US",
    };
    const [job] = await bigQuery.createQueryJob(options);
    const [rows] = await job.getQueryResults();
    return rows;
};
