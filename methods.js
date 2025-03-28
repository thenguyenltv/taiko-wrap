const { Web3 } = require('web3');
let RPC = process.env.RPC_URL;
if (RPC === undefined) {
    RPC = "https://rpc.hekla.taiko.xyz";
}

const web3 = new Web3(new Web3.providers.HttpProvider(RPC));

// Catch unhandled promise rejections and uncaught exceptions
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err.message);
});

const {
    handleError,
    convertWeiToNumber,
    timeoutPromise
} = require('./utils');

const {
    CEIL_GAS,
    MIN_GAS_PRICE,
    MIN_BALANCE
} = require('./constant');

const wait_3s = 3000;
const GAS_USAGE_FOR_VOTE = 21116;
const MAX_GAS_FOR_1VOTE = 0.0000045;

/**
 * Retrieves and calculates the transaction fee for a given transaction hash.
 * 
 * @param {string} txHash - The hash of the transaction to retrieve the fee for.
 * @returns {Promise<void>} - A promise that resolves when the transaction fee is calculated and logged.
 * 
 */
async function getTransactionFee(txHash) {
    try {
        const txReceipt = await handleError(web3.eth.getTransactionReceipt(txHash));

        const gasUsed = BigInt(txReceipt.gasUsed);
        const gasPrice = BigInt(txReceipt.effectiveGasPrice);

        const fee = gasUsed * gasPrice;
        // const feeInEther = web3.utils.fromWei(fee.toString(), 'ether');

        return fee;
    } catch (error) {
        throw new Error(`Get fee failed with error ${error.message}`);
    }
}

/**
 * Check the finality of a transaction and retrieve the transaction fee.
 * The process will not exceed 2 minutes.
 * 
 * @param {*} receipt - (Must define) The transaction receipt to check finality for 
 * @returns {BigInt} - The transaction fee if the transaction is final, or 0n if it times out.
 */
async function checkFinality(receipt) {
    // Check receipt validity
    if (!receipt || typeof receipt !== 'object' || !receipt.blockNumber || !receipt.transactionHash) {
        throw new Error('Invalid receipt object provided.');
    }

    const startTime = Date.now();
    while (true) {
        try {
            const currentBlock = await handleError(web3.eth.getBlockNumber());
            if (currentBlock >= receipt.blockNumber) {
                const fee = await getTransactionFee(receipt.transactionHash);
                if (fee !== '0') {
                    return BigInt(fee);
                }
            } else {
                // Wait for 3 seconds before checking again
                await new Promise((resolve) => setTimeout(resolve, wait_3s));
            }

        } catch (error) {
            // console.error('Error checkFinality:', error.message);
        }

        // Check timeout
        if (Date.now() - startTime > wait_3s * 20) {
            throw new Error('Timeout exceeded while waiting for transaction finality.');
        }
    }
}


// /**
//  * 
//  * @param {BigInt} ceil_gas - The ceil of gas in wei
//  */
// async function poolingGas(ceil_gas) {
//     let gas_price = 0n;
//     let time_count = 0;
//     while (true) {
//         gas_price = await handleError(web3.eth.getGasPrice());
//         if (gas_price != 0n && gas_price <= ceil_gas)
//             return gas_price

//         await new Promise((resolve) => setTimeout(resolve, wait_3s/3));
//         time_count++;

//         if (time_count % 60 == 0) {
//             console.log(".......Wait next 60s to lower GAS.")
//         }
//     }
// }

/**
 * Fetches the gas price every specified interval for a total duration and returns 
 * the adjusted lowest gas price based on observed prices during the polling period.
 * 
 * @param {*} pollingInterval - Interval in milliseconds between each gas price fetch (default: 700ms or 0.7 second).
 * @param {*} maxDuration - Total duration in milliseconds for polling gas prices (default: 5000ms or 5 seconds).
 * @returns {Promise<BigInt>} - The adjusted lowest gas price after polling.
 */
async function getLowGasPrice(lastestGas = 200000002n, pollingInterval = 700, maxDuration = 10000) {
    try {
        let lowestGasPrice = await handleError(web3.eth.getGasPrice());
        if (lowestGasPrice <= lastestGas + 1n) {
            await new Promise((resolve) => setTimeout(resolve, wait_3s / 3));
            return lowestGasPrice;
        }

        let secondLowestGasPrice = lowestGasPrice;

        const maxAttempts = Math.floor(maxDuration / pollingInterval);

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, pollingInterval)); // Wait for the polling interval

            let currentGasPrice = await handleError(web3.eth.getGasPrice());
            if (currentGasPrice <= lastestGas) {
                await new Promise((resolve) => setTimeout(resolve, wait_3s / 3));
                return currentGasPrice;
            }

            if (BigInt(currentGasPrice) < BigInt(lowestGasPrice)) {
                secondLowestGasPrice = lowestGasPrice; // Update second lowest
                lowestGasPrice = currentGasPrice; // Update lowest
            } else if (
                BigInt(currentGasPrice) > BigInt(lowestGasPrice) &&
                BigInt(currentGasPrice) < BigInt(secondLowestGasPrice)
            ) {
                secondLowestGasPrice = currentGasPrice; // Update second lowest
            }
        }

        // Adjust the lowest gas price based on the formula
        lowestGasPrice = BigInt(lowestGasPrice) +
            (BigInt(secondLowestGasPrice) - BigInt(lowestGasPrice)) / BigInt(2);

        // console.log(`Final adjusted gas price: ${convertWeiToNumber(lowestGasPrice, 9, 3)} gwei`);

        return lowestGasPrice;
    } catch (error) {
        console.error("An error occurred while fetching gas prices:", error.message);
        throw error;
    }
}

async function checkBalanceAndSetWithdraw(account) {
    const balance_in_eth = convertWeiToNumber(await handleError(web3.eth.getBalance(account.address)), 18, 5);
    return balance_in_eth > MIN_BALANCE ? 0 : 1;
}

/**
 * Cancel transaction function
 * To cancel a transaction: replacing the transaction with another 0 ETH transaction 
 * with a higher (10%) gas fee sending to yourself with the same nonce as the pending transaction
 */
async function cancelTransaction(account, gasPrice) {
    try {
        // upgrade 10% gas fee
        gasPrice = gasPrice * BigInt(150) / BigInt(100);
        console.log("Canceling transaction with gas price:", gasPrice);

        // get the latest nonce
        let nonce = await web3.eth.getTransactionCount(account.address);

        // create a new transaction with the same nonce to send to yourself (type 0)
        const tx = {
            from: account.address,
            to: account.address,
            value: 0,
            gas: 21000,
            gasLimit: 42000,
            gasPrice,
            nonce
        };

        // sign and send the transaction
        const signedTx = await account.signTransaction(tx);
        await new Promise((resolve) => setTimeout(resolve, wait_3s / 3));
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        return receipt;
    } catch (error) {
        console.error("An error occurred while canceling the transaction:", error.message);
    }
}

async function sendFunds(fromAccount, toAddress, amount) {
    try {
        const gas_price = await getLowGasPrice(200000002n);
        const tx = {
            from: fromAccount.address,
            to: toAddress,
            value: web3.utils.toWei(amount.toString(), 'ether'),
            gas: 21000,
            gasPrice: gas_price
        };
        const signedTx = await fromAccount.signTransaction(tx);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        return receipt;
    } catch (error) {
        console.error(`Error sending funds from ${fromAccount.address} to ${toAddress}:`, error.message);
    }
}

/**
 * Function to deposit funds to the wrapped token contract
 * @param {Contract} SM_USE 
 * @param {ether} amount the amount (in Ether) of ETH to deposit
 * @param {account} account 
 * @returns 
 */
async function deposit(SM_USE, chainID, amount_in_eth, account, tnxGasPrice) {
    let pre_gas = 0n, gas_price = 200000002n;
    try {
        // Prepare the transaction
        const amount_in_wei = web3.utils.toWei(amount_in_eth.toString(), 'ether');
        const estimatedGas = await SM_USE.methods.deposit(amount_in_eth).estimateGas();
        const gas_limit = estimatedGas * BigInt(15) / BigInt(10);
        const nonce = await web3.eth.getTransactionCount(account.address, 'pending');
        const txData = SM_USE.methods.deposit(amount_in_eth).encodeABI();

        gas_price = (tnxGasPrice !== undefined) ? BigInt(tnxGasPrice) : await getLowGasPrice(200000002n);

        const max_priority_fee_per_gas = 100_000n; // in wei = 0.0001 gwei;
        const max_fee_per_gas = CEIL_GAS;

        // revert if CEIL_GAS < max_priority_fee_per_gas
        if (max_priority_fee_per_gas > CEIL_GAS) {
            throw new Error(`Max priority fee per gas is greater than the ceil gas: ${max_priority_fee_per_gas}`);
        }

        // Predict the gas fee
        pre_gas = (max_priority_fee_per_gas * BigInt(estimatedGas)).toString(); // a BigInt in wei

        /** Transaction type 2 */
        const tx_params = {
            nonce,
            from: account.address,
            to: SM_USE.options.address,
            value: amount_in_wei, // in wei
            data: txData,
            maxPriorityFeePerGas: max_priority_fee_per_gas,
            maxFeePerGas: max_fee_per_gas,
            gasLimit: gas_limit,
            type: '0x2',
            chainID: chainID
        };

        // Sign and send the transaction
        const signedTx = await account.signTransaction(tx_params);
        // const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        // Create a promise for sending the transaction
        const transactionPromise = web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        // Limit the receipt time 
        const receipt = await Promise.race([
            transactionPromise,
            timeoutPromise(3 * 60 * wait_3s / 3),
        ]);

        return [receipt, pre_gas, gas_price];

    } catch (error) {
        console.error("An error occurred while depositing:", error.message);
        return [null, pre_gas.gas_price];
    }
}

/** 
 * @param amount the amount (in wei) of WETH to withdraw
 * 
 * Function to withdraw funds from the wrapped token contract
*/
async function withdraw(SM_USE, chainID, amount, account, tnxGasPrice) {
    let pre_gas = 0n, gas_price;
    try {
        // Prepare the transaction
        // let weth_in_wei = amount - (amount / BigInt(500));
        const txData = SM_USE.methods.withdraw(amount).encodeABI();
        const estimatedGas = await web3.eth.estimateGas({
            from: account.address,
            to: SM_USE.options.address,
            data: txData
        });
        const gas_limit = estimatedGas * BigInt(15) / BigInt(10);
        const nonce = await web3.eth.getTransactionCount(account.address, 'pending');
        gas_price = (tnxGasPrice !== undefined) ? BigInt(tnxGasPrice) : await getLowGasPrice(200000002n);
        const max_priority_fee_per_gas = 100_000n; // in wei = 0.0001 gwei;
        const max_fee_per_gas = CEIL_GAS;

        // revert if CEIL_GAS < max_priority_fee_per_gas
        if (max_priority_fee_per_gas > CEIL_GAS) {
            throw new Error(`Max priority fee per gas is greater than the ceil gas: ${max_priority_fee_per_gas}`);
        }

        // Predict the gas fee
        pre_gas = (max_priority_fee_per_gas * BigInt(estimatedGas)).toString(); // a BigInt in wei

        /** Transaction type 2 */
        const tx_params = {
            nonce,
            from: account.address,
            to: SM_USE.options.address,
            data: txData,
            maxPriorityFeePerGas: max_priority_fee_per_gas,
            maxFeePerGas: max_fee_per_gas,
            gasLimit: gas_limit,
            type: '0x2',
            chainID: chainID
        };

        // Send the transaction
        const signedTx = await account.signTransaction(tx_params);
        // const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        // // Create a promise for sending the transaction
        const transactionPromise = web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        // Limit the receipt time to 5 minutes (300,000 milliseconds)
        const receipt = await Promise.race([
            transactionPromise,
            timeoutPromise(3 * 60 * wait_3s / 3), // 5 minutes in milliseconds
        ]);
        return [receipt, pre_gas, gas_price];

    } catch (error) {
        console.error("An error occurred while withdrawing:", error.message);
        return [null, pre_gas, gas_price];
    }
}

/**
 * Loop deposit and withdraw based on balance and gas constraints.
 *
 * @param {object} SM_USE - Smart contract instance to interact with for deposit/withdraw actions.
 * @param {number} chainID - ID of the blockchain network to execute transactions on.
 * @param {number} indexTnx - Index of the transaction for tracking purposes.
 * @param {object} account - Account object or address used to perform transactions.
 * @param {number} CEIL_GAS - Maximum gas price for the transactions.
 * 
 * @returns {Array} Returns an array containing:
 *    - {boolean} status - Indicates success (true) or failure (false) of the loop operations.
 *    - {bigint} fee - Total gas fee incurred for the transactions.
 *    - {number} amount - The amount of ETH involved in the transaction, represented as a number.
 */
async function DepositOrWithdraw(typeTnx, SM_USE, chainID, indexTnx, account, tnxGasPrice) {
    const min_eth_in_wei = BigInt(web3.utils.toWei(MIN_BALANCE.toString(), 'ether'));
    let status = true;
    let fee = 0n;
    let receipt, pre_gas = 0n, amount = 0, gas_price = 200000002n;

    try {
        // typeTnx=0 --> deposit
        if (typeTnx === 0) {
            // update balance in seconds
            let balance = await web3.eth.getBalance(account.address);
            let amount_in_wei = balance - (BigInt(min_eth_in_wei) / 2n);
            await (async () => {
                let attempts = 0;
                const maxAttempts = 5;

                // Check balance in maxAttempts times
                while (amount_in_wei < min_eth_in_wei && attempts < maxAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, wait_3s));
                    balance = await web3.eth.getBalance(account.address);
                    amount_in_wei = balance - (BigInt(min_eth_in_wei) / 2n);
                    attempts++;
                }
                if (amount_in_wei < min_eth_in_wei) {
                    throw new Error(`Insufficient balance to deposit, current balance: ${convertWeiToNumber(balance)} ETH, need at least ${convertWeiToNumber(min_eth_in_wei)} ETH`);
                }
                else {
                    console.log(`\n${indexTnx + 1}. Deposit...`, convertWeiToNumber(amount_in_wei), "ETH to WETH");
                }
            })();

            if (chainID == 167009) {
                // amount_in_wei = amount_in_wei / 25n;
                console.log("\nAdjust amount in TESTNET...", convertWeiToNumber(amount_in_wei));
                await new Promise((resolve) => setTimeout(resolve, wait_3s * 3));
            }

            let amountInEther = web3.utils.fromWei(amount_in_wei.toString(), 'ether');
            amount = Number(amountInEther);

            // ============================================
            [receipt, pre_gas, gas_price] = await deposit(SM_USE, chainID, amountInEther, account, tnxGasPrice);
            // ============================================

            fee = await checkFinality(receipt);

            // check until balance of WETH >= amount_in_wei
            await (async () => {
                let newBalanceOf = await SM_USE.methods.balanceOf(account.address).call();
                const start = new Date().getTime();
                let end, time;
                while (newBalanceOf < amount_in_wei) {
                    await new Promise((resolve) => setTimeout(resolve, wait_3s / 2));
                    newBalanceOf = await SM_USE.methods.balanceOf(account.address).call();
                    end = new Date().getTime();
                    time = Math.round((end - start) / 1000);
                    if (time % 30 == 0) {
                        console.log("Check balacne exceed 30s, wait...");
                    }

                    if (time >= 120) {
                        throw new Error(`Balance - Timeout exceeded while waiting for updated.`);
                    }
                }
            })();

            return [status, fee, amount, gas_price];
        }
        else { // typeTnx=1 --> withdraw
            // Before withdraw, check balance of WETH
            let balanceOf = await SM_USE.methods.balanceOf(account.address).call();
            let weth_in_wei = balanceOf - (BigInt(min_eth_in_wei) / 2n);
            await (async () => {
                let attempts = 0;
                const maxAttempts = 5;

                while (weth_in_wei < min_eth_in_wei && attempts < maxAttempts) {
                    await new Promise((resolve) => setTimeout(resolve, wait_3s));
                    balanceOf = await SM_USE.methods.balanceOf(account.address).call();
                    weth_in_wei = balanceOf - (balanceOf / BigInt(500));
                    attempts++;
                }
                if (weth_in_wei < min_eth_in_wei) {
                    throw new Error(`Insufficient balance to withdraw, current balance: ${convertWeiToNumber(balanceOf)} WETH, need at least ${convertWeiToNumber(min_eth_in_wei)} WETH`);
                }
                else {
                    console.log(`\n${indexTnx + 1}. Withdraw...`, convertWeiToNumber(weth_in_wei), "WETH to ETH");
                }
            })();

            if (chainID == 167009) {
                // weth_in_wei = weth_in_wei / 25n;
                console.log("\nAdjust amount in TESTNET...", convertWeiToNumber(weth_in_wei));
                await new Promise((resolve) => setTimeout(resolve, wait_3s * 3));
            }

            // ============================================
            [receipt, pre_gas, gas_price] = await withdraw(SM_USE, chainID, weth_in_wei, account, tnxGasPrice);
            // ============================================

            fee = await checkFinality(receipt);

            // check until balance of ETH >= weth_in_wei
            await ( async () => {

                let newBalance = await web3.eth.getBalance(account.address);
                const start = new Date().getTime();
                let end, time;

                while (newBalance < weth_in_wei) {
                    await new Promise((resolve) => setTimeout(resolve, wait_3s / 2));
                    newBalance = await web3.eth.getBalance(account.address);
                    end = new Date().getTime();
                    time = Math.round((end - start) / 1000);
                    if (time % 30 == 0) {
                        console.log("Check balacne exceed 30s, wait...");
                    }

                    if (time >= 120) {
                        throw new Error(`Balance - Timeout exceeded while waiting for updated.`);
                    }

                }
            })();

            return [status, fee, 0, gas_price];
        }
    } catch (err) {  
        console.error("Wrap/Unwrap failed:", err.message);
        console.log("fee:", fee, "amount:", amount, "pre_gas:", pre_gas);
        // receipt undefined, dm await roi van return undefined, rpc dom?
        if (err.message.includes("Invalid receipt object provided")
            || err.message.includes("Transaction not found")) {
            status = false;
            fee = Number(pre_gas);
            amount = amount === 0 ? 0.1 : amount;
            await new Promise((resolve) => setTimeout(resolve, wait_3s * 3));
        }
        else {
            status = false;
            pre_gas = (pre_gas === undefined || typeof pre_gas !== 'number') ? 0 : Number(pre_gas);
            fee = typeof pre_gas === 'number' ? pre_gas : 0n;
        }

        return [status, fee, amount, gas_price];
    }
}

/**
 * @param {web3.eth.accounts} account 
 * @param {} tx 
 * @returns 
 */
async function tnxType2(account, tx) {
    try {
        // check info: nonce, gasPrice, gasLimit, to, data
        // Required fields
        const requiredFields = ['nonce', 'to', 'data'];

        // Check if all required fields are present
        requiredFields.forEach(field => {
            if (!tx.hasOwnProperty(field)) {
                throw new Error(`Transaction is missing required field: ${field}`);
            }
        });

        // Get default values
        if (tx.nonce === undefined) {
            tx.nonce = await web3.eth.getTransactionCount(account.address);
            console.log("Nonce unf:", tx.nonce);
        }

        if (tx.maxFeePerGas === undefined) {
            const baseFee = await web3.eth.getBlock('latest').then(block => block.baseFeePerGas);
            const maxFeePerGas = web3.utils.toHex(BigInt(baseFee) + BigInt(maxPriorityFeePerGas));
            console.log("Max Fee Per Gas unf:", maxFeePerGas);
        }

        if (tx.maxPriorityFeePerGas === undefined) {
            maxPriorityFeePerGas = web3.utils.toWei('1', 'gwei');
            console.log("Max Priority Fee Per Gas unf:", maxPriorityFeePerGas);
        }

        if (tx.gasLimit === undefined) {
            tx.gasLimit = await web3.eth.estimateGas(tx) * BigInt(2);
            console.log("Gas Limit unf:", tx.gasLimit);
        }

        if (tx.value === undefined) {
            tx.value = '0x00';
        }

        const signed = await account.signTransaction(tx);
        const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
        return receipt;
    } catch (error) {
        console.error('Error creating and sending transaction:', error.message);
    }
}

/**
 * Return TNX_PER_BATCH, GAS_FEE_INCREASE_PERCENT
 * @param {number} Total_Gas - Total gas amount in ETH
 * @param {BigInt} Gas_Price - Current gas price (e.g., 125000001n)
 */
function ProcessTotalGas(Total_Gas, Gas_Price) {
    let avg_gas_per_tnx = parseFloat(web3.utils.fromWei((Gas_Price * BigInt(GAS_USAGE_FOR_VOTE)).toString(), 'ether'));

    if (avg_gas_per_tnx > 0.0000045) {
        console.log("Gas price is so high, wait and try again!");
        return [null, null]
    }

    // Tinh phan tram tang gas fee
    const GAS_FEE_INCREASE_PERCENT = Math.max(0, Math.round((MAX_GAS_FOR_1VOTE - Number(avg_gas_per_tnx)) / Number(avg_gas_per_tnx) * 100));

    // Tinh so luong transaction moi batch
    let TNX_PER_BATCH = Math.floor(Math.random() * (3)) + 13;
    // Tinh so luong transaction con lai
    avg_gas_per_tnx = avg_gas_per_tnx * (GAS_FEE_INCREASE_PERCENT / 100) + avg_gas_per_tnx;
    let num_tnx = Math.ceil(Total_Gas / avg_gas_per_tnx);
    // Dieu chinh so luong transaction moi batch
    if (num_tnx < TNX_PER_BATCH) {
        TNX_PER_BATCH = num_tnx;
    }

    return [TNX_PER_BATCH, GAS_FEE_INCREASE_PERCENT];
}

module.exports = {
    checkFinality,
    checkBalanceAndSetWithdraw,
    cancelTransaction,
    sendFunds,
    deposit,
    withdraw,
    DepositOrWithdraw,
    getTransactionFee,
    getLowGasPrice,
    tnxType2,
    ProcessTotalGas
};