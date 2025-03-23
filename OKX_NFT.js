const { Web3 } = require('web3');
const cryptoJS = require('crypto-js');
const ethers = require('ethers');
const axios = require("axios");

let RPC_URL = process.env.RPC_URL;
if (RPC_URL === undefined) {
    RPC_URL = "https://rpc.hekla.taiko.xyz";
}

// const {
//     WEB3_RPC_URL,
//     CHAINID,
//     MAIN_OKX_API,
//     MAIN_SECRET_KEY,
//     MAIN_PASSPHRASE,
//     MAIN_PRIVATE_KEY,
//     MAIN_ADDRESS,
//     B400_OKX_API,
//     B400_PASSPHRASE,
//     B400_SECRET_KEY,
//     B400_PRIVATE_KEY,
//     B400_ADDRESS,
//     ETHER_TOKEN,
//     TOKDEN_ID
// } = require('./constant');


const web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL));
const apiBaseUrl = 'https://www.okx.com/';
const creatListingPath = "/api/v5/mktplace/nft/markets/create-listing";
const queryListingPath = '/api/v5/mktplace/nft/markets/listings?';
const submitOrderPath = "/priapi/v1/nft/trading/seaport/step/submitOrder";
const buyOrderPath = '/api/v5/mktplace/nft/markets/buy';

const POST = "POST";
const GET = "GET";
const contentTypeAppJSon = "application/json";



/**
 * List NFT on OKX marketplace using API v5
 * - Some parameters must be global variables: apiBaseUrl
 * - All parameters must be passed as arguments
 * @param {string} secretKey - API secret key on OKX
 * @param {string} apiKey - API key on OKX
 * @param {string} passphrase - API passphrase on OKX
 * @param {string} chain - Chain name, default: "taiko"
 * @param {address} walletAddress - Wallet address for creating the listing
 * @param {object} item - NFT item: {tokenId, collectionAddress, price, count, currencyAddress, platform} 
 * @returns {Promise} response - The response from the API
 */
async function listNFT(
    secretKey,
    apiKey,
    passphrase,
    chain = "taiko",
    walletAddress,
    item
) {
    const timestamp = new Date(Date.now()).toISOString();
    var validTime = new Date(timestamp);
    validTime.setDate(validTime.getDate() + 7);
    var expirationTimestamp = Math.floor(validTime.getTime() / 1000); // Convert to seconds

    const body = JSON.stringify({
        chain,
        walletAddress,
        items: [
            {
                ...item,
                validTime: expirationTimestamp,
            }
        ]
    });

    const signString = timestamp + POST + creatListingPath + body;
    const sign = cryptoJS.enc.Base64.stringify(
        cryptoJS.HmacSHA256(signString, secretKey)
    );

    try {
        const response = await axios.post(apiBaseUrl + creatListingPath, body, {
            headers: {
                "Content-Type": contentTypeAppJSon,
                "OK-ACCESS-KEY": apiKey,
                "OK-ACCESS-TIMESTAMP": timestamp,
                "OK-ACCESS-PASSPHRASE": passphrase,
                "OK-ACCESS-SIGN": sign,
            },
        });
        // console.log("List NFT Response:", JSON.stringify(response.data, null, 2));
        return response;
    } catch (error) {
        console.error("Error when listNFT:", error.response ? error.response.data : error.message);
    }
}

/**
 * Check if the list NFT response contains the NFT
 * In Steps, if step 1 - approve is completed, then step 2 - submitOrder is executed
 * --> Check if step 1 is completed, then return true
 */
function CheckListNFT(response) {
    if (response.data?.data?.steps[0]?.items[0]?.status === 'complete') {
        return true;
    }
    return false;
}

/**
 * Sign and submit the order for listing NFT
 * @param {object} response - The response from the listNFT API
 * @param {string} secretKey - API secret key on OKX
 * @param {string} apiKey - API key on OKX
 * @param {string} passphrase - API passphrase on OKX
 * @param {string} privateKey - Private key of the wallet
 * @returns {Promise} submitResponse - The response from the API
 */
async function signAndSubmitOrder(
    response,
    secretKey,
    apiKey,
    passphrase,
    privateKey
) {
    try {
        // Khai báo các biến cần thiết
        const timestamp = new Date().toISOString().slice(0, -5) + 'Z';
        const signString = timestamp + POST + submitOrderPath + JSON.stringify(response.data?.data?.steps[1]?.items[0]?.post.body);

        // Lấy dữ liệu cần ký từ API
        const domain = response.data?.data?.steps[1]?.items[0]?.domain;
        const types = response.data?.data?.steps[1]?.items[0]?.types;
        const value = response.data?.data?.steps[1]?.items[0]?.data;

        delete types.EIP712Domain;
        delete value.totalOriginalConsiderationItems; //???


        const sign = cryptoJS.enc.Base64.stringify(
            cryptoJS.HmacSHA256(signString, secretKey)
        );

        // Ký dữ liệu bằng private key thông qua ethers.js
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(privateKey, provider);

        const signature = await wallet.signTypedData(
            domain,
            types,
            value
        );

        // Gửi chữ ký lên API OKX
        const signedOrder = {
            ...response.data?.data?.steps[1]?.items[0]?.post.body,
            signature: signature, // Thêm chữ ký vào payload
        };

        const submitResponse = await axios.post(apiBaseUrl + submitOrderPath, signedOrder, {
            headers: {
                "Content-Type": contentTypeAppJSon,
                "OK-ACCESS-KEY": apiKey,
                "OK-ACCESS-TIMESTAMP": timestamp,
                "OK-ACCESS-PASSPHRASE": passphrase,
                "OK-ACCESS-SIGN": sign,
            },
        });

        // console.log("Submit Order Response:", submitResponse.data);
        return submitResponse;

    } catch (error) {
        console.error("Error when signAndSubmitOrder:", error.response ? error.response.data : error.message);
    }
}

// async function main() {
//     try {
//         const response = await listNFT();
//         const isListed = CheckListNFT(response);
//         if (!isListed) {
//             throw new Error("Step 1 - Chưa Approve NFT hoặc lỗi API!");
//         }
//         if (!response || !response.data) {
//             throw new Error("API không trả về dữ liệu hợp lệ!");
//         }

//         await signAndSubmitOrder(response);
//     } catch (error) {
//         console.error("Lỗi khi gọi listNFT:", error);
//     }
// }


/**
 * Query NFT listing on OKX marketplace using API v5
 * https://www.okx.com/web3/build/docs/waas/marketplace-query-listing
 * - Some parameters must be global variables: apiBaseUrl
 * @param {string} secretKey - API secret key on OKX
 * @param {string} apiKey - API key on OKX
 * @param {string} passphrase - API passphrase on OKX
 * @param {string} chain - Chain name, default: "taiko"
 * @param {address} tokenId - (optional) ID of the NFT
 * @param {address} collectionAddress - (optional) Address of the contract for an NFT
 * @param {address} walletListingNFT - (optional) Filter by the order makers wallet address
 * @returns {Promise} response - The response from the API
 */
async function GetQueryListing(
    secretKey,
    apiKey,
    passphrase,
    chain,
    tokenId = null,
    collectionAddress = null,
    walletListingNFT = null,
) {
    try {
        const timestamp = new Date().toISOString().slice(0, -5) + 'Z';

        let params = {
            chain: chain,
            ...(collectionAddress !== null && { collectionAddress: collectionAddress }),
            ...(tokenId !== null && { tokenId: tokenId }),
            ...(walletListingNFT !== null && { maker: walletListingNFT })
        };
        // console.log("Params for GetQueryListing:", params);


        const signStr = timestamp + GET + queryListingPath + new URLSearchParams(params).toString();
        const sign = cryptoJS.enc.Base64.stringify(cryptoJS.HmacSHA256(signStr, secretKey));

        const response = await axios.get(apiBaseUrl + queryListingPath, {
            headers: {
                'Content-Type': contentTypeAppJSon,
                'OK-ACCESS-KEY': apiKey,
                'OK-ACCESS-SIGN': sign,
                'OK-ACCESS-TIMESTAMP': timestamp,
                'OK-ACCESS-PASSPHRASE': passphrase,
            },
            params: params,
        });
        // console.log("Query Listing Response:", JSON.stringify(response.data, null, 2));
        return response;
    } catch (error) {
        console.error('Error querying listing:', error.response ? error.response.data : error.message);
    }
}

/**
 * Check if the query listing response contains the expect NFT
 * @param {Object} response - The response from the query listing API
 * @param {Number} tokenId - (optional) The tokenId of the NFT
 * @param {address} collectionAddress - (optional) The collection address of the NFT
 * @param {address} walletListingNFT - (optional) The wallet address that listed the NFT
 * @returns {String} orderId - The orderId of the NFT listing
 */
function CheckQueryListing(
    response,
    tokenId = null,
    collectionAddress = null,
    walletListingNFT = null
) {
    const data = response.data?.data?.data;
    if (data.length === 0 || !data) {
        console.log("No Data to CheckQueryListing");
        return null;
    }
    else {
        console.log(`Data to CheckQueryListing:
            - tokenId: ${data[0].tokenId ?? "N/A"}
            - maker: ${data[0].maker ?? "N/A"}
            - price: ${data[0].price ?? "N/A"}`);
    }
    let flag = true;
    if (data) {
        for (let i = 0; i < data.length; i++) {
            if (tokenId && Number(data[i].tokenId) !== tokenId)
                flag = false;
            if (collectionAddress && data[i].collectionAddress !== collectionAddress)
                flag = false;
            if (walletListingNFT && data[i].maker !== walletListingNFT)
                flag = false;

            if (flag)
                return data[i].orderId;
            flag = true;
        }
    }
    return null;
}

/**
 * Buy NFT on OKX marketplace using API v5
 * https://www.okx.com/web3/build/docs/waas/marketplace-buy-orders
 * - Some parameters must be global variables: apiBaseUrl, buyOrderPath, method: POST
 * - All parameters must be passed as arguments
 * @param {string} secretKey - API secret key on OKX
 * @param {string} apiKey - API key on OKX
 * @param {string} passphrase - API passphrase on OKX
 * @param {string} chain - Chain name, default: "taiko"
 * @param {address} walletAddress - Address of wallet filling.
 * @param {object} item - Buy item model: {orderId, takeCount}
 * @returns {Promise} response - The response from the API
 */
async function PostBuyNFT(
    secretKey,
    apiKey,
    passphrase,
    chain,
    walletAddress,
    item,
) {
    try {
        const timestamp = new Date().toISOString().slice(0, -5) + 'Z';

        const body = {
            chain: chain,
            items: item,
            walletAddress: walletAddress,
        }

        const signStr = timestamp + POST + buyOrderPath + JSON.stringify(body);
        const sign = cryptoJS.enc.Base64.stringify(cryptoJS.HmacSHA256(signStr, secretKey));

        const response = await axios.post(apiBaseUrl + buyOrderPath, body, {
            headers: {
                'Content-Type': contentTypeAppJSon,
                'OK-ACCESS-KEY': apiKey,
                'OK-ACCESS-SIGN': sign,
                'OK-ACCESS-TIMESTAMP': timestamp,
                'OK-ACCESS-PASSPHRASE': passphrase,
            },
        });

        return response;
    } catch (error) {
        console.error('Error placing buy order:', error.response ? error.response.data : error.message);
    }
}

/**
 * Sign and buy NFT on OKX marketplace using API v5
 * @param {object} transactionData - Transaction data for buying NFT
 * @param {AccountEVM} account - Account for signing transaction
 * @returns {Promise} receipt - The receipt from the transaction
 */
async function SignAndBuyNFT(
    transactionData,
    account,
) {
    try {
        // Điền các thông tin cần thiết cho giao dịch
        const nonce = await web3.eth.getTransactionCount(account.address, 'latest');
        const gas_limit = 768_591n; // in gwei = 0.000007 eth
        const max_priority_fee_per_gas = 100_000n; // in wei = 0.0001 gwei
        const max_fee_per_gas = 50_000_000n; // in wei = 0.05 gwei
        transactionData.nonce = nonce;
        transactionData.maxPriorityFeePerGas = max_priority_fee_per_gas;
        transactionData.maxFeePerGas = max_fee_per_gas;
        transactionData.gasLimit = gas_limit;
        transactionData.type = '0x2';

        console.log('transactionData:', transactionData);

        const signedTx = await account.signTransaction(transactionData);
        // console.log('signedTx:', signedTx);

        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        return receipt;

    } catch (error) {
        console.error("Error sending transaction:", error);
    }
}

async function BuyNFTOnOKX(
    secretKey,
    apiKey,
    passphrase,
    chain,
    tokenId = null,
    collectionAddress = null,
    walletListingNFT = null,
    walletAddress,
    account,
) {
    try {
        const response = await GetQueryListing(
            secretKey,
            apiKey,
            passphrase,
            chain,
            tokenId,
            collectionAddress,
            walletListingNFT,
        );
        console.log(`Info query: ${chain}, ${tokenId}, ${collectionAddress}, ${walletListingNFT}`);
        const orderId = CheckQueryListing(
            response,
            collectionAddress,
            walletListingNFT,
        );
        if (orderId === null) {
            console.log("NFT not found");
            return;
        }

        const item = {
            orderId: orderId,
            takeCount: 1
        }
        const res = await PostBuyNFT(
            secretKey,
            apiKey,
            passphrase,
            chain,
            walletAddress,
            item,
        );

        // Lấy dữ liệu từ response
        const rawTnxData = res.data?.data.steps[0].items[0];
        const contractAddress = rawTnxData.contractAddress;
        const inputData = rawTnxData.input;
        const value = Number(rawTnxData.value); // in wei
        // console.log("Raw transaction data:", rawTnxData);

        // Dữ liệu giao dịch lấy từ OKX API
        const transactionData = {
            to: contractAddress,
            data: inputData,
            value: value, // Giá trị cần gửi (wei)
        };
        // const receipt = await SignAndBuyNFT(
        //     transactionData,
        //     walletAddress,
        //     account,
        // );
        let receipt = null;
        return receipt ? receipt : null;
    } catch (error) {
        console.error("Error buying NFT:", error.message);
    }
}

module.exports = {
    listNFT,
    CheckListNFT,
    signAndSubmitOrder,
    GetQueryListing,
    CheckQueryListing,
    PostBuyNFT,
    SignAndBuyNFT,
    BuyNFTOnOKX,
};