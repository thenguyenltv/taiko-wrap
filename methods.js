const { Web3, types } = require('web3');
const web3 = new Web3(new Web3.providers.HttpProvider(process.env.RPC_URL));


/**
 * Retrieves and calculates the transaction fee for a given transaction hash.
 * 
 * @param {string} txHash - The hash of the transaction to retrieve the fee for.
 * @returns {Promise<void>} - A promise that resolves when the transaction fee is calculated and logged.
 * 
 */
async function getTransactionFee(txHash) {
    const txReceipt = await web3.eth.getTransactionReceipt(txHash);
    const tx = await web3.eth.getTransaction(txHash);

    if (txReceipt && tx) {
        const gasUsed = BigInt(txReceipt.gasUsed);
        const gasPrice = BigInt(tx.gasPrice);

        const fee = gasUsed * gasPrice;
        // const feeInEther = web3.utils.fromWei(fee.toString(), 'ether');s

        return fee.toString();
    } else {
        console.log('Get fee: Transaction not found');
        return '0';
    }
}

/**
 * Cancel transaction function
 * To cancel a transaction: replacing the transaction with another 0 ETH transaction 
 * with a higher (10%) gas fee sending to yourself with the same nonce as the pending transaction
 */
async function cancelTransaction(latestGasPrice, account) {
    try {
        // upgrade 10% gas fee
        const gasPrice = latestGasPrice * BigInt(110) / BigInt(100);
        console.log("Canceling transaction with gas price:", gasPrice);

        // get the latest nonce
        let nonce = await web3.eth.getTransactionCount(account.address, 'pending');

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
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        return receipt;
    } catch (error) {
        console.error("An error occurred while canceling the transaction:", error.message);
    }
}

/**
 * Check the finality of a transaction and retrieve the transaction fee.
 * The process will not exceed 2 minutes.
 * 
 * @param {*} receipt - (Must define) The transaction receipt to check finality for 
 * @returns {BigInt} - The transaction fee if the transaction is final, or 0n if it times out.
 */
async function checkFinality(receipt, fee) {

    // Check receipt define
    if (!receipt || typeof receipt !== 'object' || !receipt.blockNumber || !receipt.transactionHash) {
        console.error('Invalid receipt object provided.');
    }

    const startTime = Date.now();
    while (true) {
        const currentBlock = await web3.eth.getBlockNumber();
        if (currentBlock > receipt.blockNumber) {
            fee = await getTransactionFee(receipt.transactionHash);
            break;
        }
        else {
            // Wait for 5 seconds before checking again
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        // Not running over 2 mins
        if (Date.now() - startTime > 120000) {
            console.error('Timeout exceeded while waiting for transaction finality.');
            break;
        }
    }
}

/**
 * 
 * @param {BigInt} ceil_gas - The ceil of gas in wei
 */
async function poolingGas(ceil_gas) {
    let gas_price = 0n;
    let time_count = 0;
    while (true) {
        gas_price = await handleError(web3.eth.getGasPrice());
        if (gas_price != 0n && gas_price <= ceil_gas)
            return gas_price

        await new Promise((resolve) => setTimeout(resolve, 1000));
        time_count++;

        if (time_count % 60 == 0) {
            console.log(".......Wait next 60s to lower GAS.")
        }
    }
}

/**
 * Fetches the gas price every specified interval for a total duration and returns 
 * the adjusted lowest gas price based on observed prices during the polling period.
 * 
 * @param {*} pollingInterval - Interval in milliseconds between each gas price fetch (default: 1000ms or 1 second).
 * @param {*} maxDuration - Total duration in milliseconds for polling gas prices (default: 10000ms or 10 seconds).
 * @returns {Promise<BigInt>} - The adjusted lowest gas price after polling.
 */
async function getLowGasPrice(pollingInterval = 700, maxDuration = 5000) {
    try {
        let lowestGasPrice = await handleError(web3.eth.getGasPrice());
        let secondLowestGasPrice = lowestGasPrice;

        const maxAttempts = Math.floor(maxDuration / pollingInterval);

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, pollingInterval)); // Wait for the polling interval

            const currentGasPrice = await handleError(web3.eth.getGasPrice());

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
        console.log(`Final adjusted lowest gas price: ${lowestGasPrice}`);

        return lowestGasPrice;
    } catch (error) {
        console.error("An error occurred while fetching gas prices:", error.message);
        throw error;
    }
}

/**
 * Function to deposit funds to the wrapped token contract
 * @param {Contract} SM_USE 
 * @param {ether} amount the amount (in Ether) of ETH to deposit
 * @param {account} account 
 * @param {BigInt} MAX_GAS in wei
 * @returns 
 */
async function deposit(SM_USE, chainID, amount_in_eth, account, MAX_GAS) {
    try {
        // Prepare the transaction
        const amount_in_wei = web3.utils.toWei(amount_in_eth.toString(), 'ether');
        const estimatedGas = await SM_USE.methods.deposit(amount_in_eth).estimateGas();
        const gas_limit = estimatedGas * BigInt(15) / BigInt(10);
        const nonce = await web3.eth.getTransactionCount(account.address, 'pending');
        const txData = SM_USE.methods.deposit(amount_in_eth).encodeABI();

        const gas_price = await getLowGasPrice();
        const max_priority_fee_per_gas = gas_price * BigInt(100 + 1) / BigInt(100);
        const max_fee_per_gas = MAX_GAS;

        // Predict the gas fee
        const pre_gas = max_priority_fee_per_gas * BigInt(estimatedGas); // a BigInt in wei

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

        // double check the balance
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const balance = await web3.eth.getBalance(account.address);
        if (balance < amount_in_wei) {
            console.log("Insufficient balance to deposit:", convertWeiToNumber(balance), "ETH");
            return;
        }

        // Sign and send the transaction
        const signedTx = await account.signTransaction(tx_params);
        // const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        // Create a promise for sending the transaction
        const transactionPromise = web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        // Limit the receipt time to 5 minutes (300,000 milliseconds)
        const receipt = await Promise.race([
          transactionPromise,
          timeoutPromise(5 * 60 * 1000), // 5 minutes in milliseconds
        ]);


        return [receipt, pre_gas];
    } catch (error) {
        console.error("An error occurred while depositing:", error.message);
    }
}

/** 
 * @param amount the amount (in wei) of WETH to withdraw
 * 
 * Function to withdraw funds from the wrapped token contract
*/
async function withdraw(SM_USE, chainID, amount, account, MAX_GAS) {
    try {
        // Prepare the transaction
        // let newAmount = amount - (amount / BigInt(500));
        const txData = SM_USE.methods.withdraw(amount).encodeABI();
        const estimatedGas = await web3.eth.estimateGas({
            from: account.address,
            to: SM_USE.options.address,
            data: txData
        });
        const gas_limit = estimatedGas * BigInt(15) / BigInt(10);
        const nonce = await web3.eth.getTransactionCount(account.address, 'pending');
        const gas_price = await getLowGasPrice();
        const max_priority_fee_per_gas = gas_price * BigInt(100 + 1) / BigInt(100);
        const max_fee_per_gas = MAX_GAS;

        // Predict the gas fee
        const pre_gas = max_priority_fee_per_gas * BigInt(estimatedGas); // a BigInt in wei

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

        // double check the balance
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const balance = await SM_USE.methods.balanceOf(account.address).call();
        if (balance < amount) {
            console.log("Insufficient balance to withdraw:", amount);
            return;
        }

        // Send the transaction
        const signedTx = await account.signTransaction(tx_params);
        // const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        // Create a promise for sending the transaction
        const transactionPromise = web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        // Limit the receipt time to 5 minutes (300,000 milliseconds)
        const receipt = await Promise.race([
          transactionPromise,
          timeoutPromise(5 * 60 * 1000), // 5 minutes in milliseconds
        ]);

        return [receipt, pre_gas];
    } catch (error) {
        console.error("An error occurred while withdrawing:", error.message);
    }
}

/**
 * Loop deposit and withdraw based on balance and gas constraints.
 *
 * @param {object} SM_USE - Smart contract instance to interact with for deposit/withdraw actions.
 * @param {number} chainID - ID of the blockchain network to execute transactions on.
 * @param {number} indexTnx - Index of the transaction for tracking purposes.
 * @param {object} account - Account object or address used to perform transactions.
 * @param {number} MIN_BALANCE - Minimum balance threshold (in ether) to trigger deposit or withdraw actions.
 * @param {number} MAX_GAS - Maximum gas price for the transactions.
 * 
 * @returns {Array} Returns an array containing:
 *    - {boolean} status - Indicates success (true) or failure (false) of the loop operations.
 *    - {bigint} fee - Total gas fee incurred for the transactions.
 *    - {number} amount - The amount of ETH involved in the transaction, represented as a number.
 */
async function DepositOrWithdraw(SM_USE, chainID, indexTnx, account, MIN_BALANCE, MAX_GAS) {
    const min_eth = web3.utils.toWei(MIN_BALANCE.toString(), 'ether');
    let status = true;
    let fee = 0n;
    let receipt, pre_gas, amount;

    try {
        const balance = await web3.eth.getBalance(account.address);

        if (balance > min_eth) {

            const amount_in_wei = balance - (BigInt(min_eth) / 2n);
            const amountInEther = web3.utils.fromWei(amount_in_wei.toString(), 'ether');

            console.log(`\n${indexTnx + 1}. Deposit...`, convertWeiToNumber(amount_in_wei), "ETH to WETH");
            [receipt, pre_gas] = await deposit(SM_USE, chainID, amountInEther, account, MAX_GAS);

            amount = Number(amountInEther);
            await checkFinality(receipt, fee);

            return [status, fee, amount];
        } else {

            const balanceOf = await SM_USE.methods.balanceOf(account.address).call();
            let newAmount = balanceOf - (balanceOf / BigInt(500));

            console.log(`\n${indexTnx + 1}. Withdraw...`, convertWeiToNumber(newAmount), "WETH to ETH");
            [receipt, pre_gas] = await withdraw(SM_USE, chainID, newAmount, account, MAX_GAS);
            
            await checkFinality(receipt, fee);

            return [status, fee, 0];
        }
    } catch (err) {
        console.error("Failed Finality transaction:", err.message);

        // receipt undefined, dm await roi van return undefined, rpc dom?
        if (err.message.includes("Invalid receipt object provided")) { 
            fee = pre_gas;
        }

        if (fee == 0n) {
            status = false;
            fee = pre_gas;
        }

        return { status, fee, amount };
    }
}

module.exports = {
    cancelTransaction,
    deposit,
    withdraw,
    DepositOrWithdraw,
    getTransactionFee,
    poolingGas,
};