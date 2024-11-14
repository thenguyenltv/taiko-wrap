const { Web3, types } = require('web3');

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.RPC_URL));

const { 
  LOG_FILE
} = require('./constant');

const fs = require('fs');
const path = require('path');

/**
 * Function to log messages to the file
 * @param {*} message 
 */
function logMessage(message) {
  const logFilePath = path.join(__dirname, LOG_FILE); 
  const timestamp = new Date().toLocaleTimeString(); // Add a timestamp
  const log = `[${timestamp}] ${message}\n`;

  // Append the log message to the file
  fs.appendFile(logFilePath, log, (err) => {
    if (err) {
      console.error('Failed to write log:', err);
    }
  });
}

/**
 * Rounds a BigInt in WEI to a specified number of decimal places.
 * 
 * @param {BigInt} num - The number in WEI to round.
 * @param {number} [decimal=18] - The number of decimals in the blockchain, default is 18.
 * @param {number} [to=5] - The number of decimal places to round to, default is 5.
 * @returns {number} The rounded amount in `ETH`.
 */
function convertWeiToNumber(num, decimal = 18, to = 5) {
  return Math.round(Number(num) / (10 ** (decimal - to))) / 10 ** to;
}

async function handleError(promise) {
  try {
      return await promise;
  } catch (error) {
      console.error("Error:", error);
      // Handle the error appropriately here
      return null; // or throw error if you want to propagate it
  }
}

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
      console.log('Transaction not found');
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
 * Get the price of ETH token
 */
async function getPrice(ids) {
  const vsCurrencies = 'usd';

  const cgk_url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${vsCurrencies}`;
  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-cg-demo-api-key': 'CG-YgDGEFnzBiwndpu5ccPSfKvT'
    }
  };

  try {
    const response = await fetch(cgk_url, options);
    const data = await response.json();
    const price = data[ids][vsCurrencies]; // Access the price directly
    return price - 1; // Return the price as a number
  } catch (error) {
    console.error('Error fetching Ethereum price:', error);
    return 0;
  }
}

/**
 * @param amount the amount (in Ether) of ETH to deposit
 * 
 * Function to deposit funds to the wrapped token contract
 */


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

    const gas_price = await poolingGas(MAX_GAS);
    const max_priority_fee_per_gas = gas_price * BigInt(100 + 1) / BigInt(100);
    const max_fee_per_gas = web3.utils.toWei('0.25', 'gwei');

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
      console.log("Insufficient balance to deposit:", amount_in_eth, "ETH");
      return;
    }

    // Sign and send the transaction
    const signedTx = await account.signTransaction(tx_params);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    const pre_gas = max_priority_fee_per_gas * BigInt(estimatedGas);

    return [receipt, pre_gas];
  } catch (error) {
    console.error("An error occurred while preparing or sending the transaction:", error.message);
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
    let newAmount = amount - (amount / BigInt(500));
    const txData = SM_USE.methods.withdraw(newAmount).encodeABI();
    const estimatedGas = await web3.eth.estimateGas({
      from: account.address,
      to: SM_USE.options.address,
      data: txData
    });
    const gas_limit = estimatedGas * BigInt(15) / BigInt(10);
    const nonce = await web3.eth.getTransactionCount(account.address, 'pending');
    const gas_price = await poolingGas(MAX_GAS);
    const max_priority_fee_per_gas = gas_price * BigInt(100 + 1) / BigInt(100);
    const max_fee_per_gas = web3.utils.toWei('0.25', 'gwei');

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
    if (balance < newAmount) {
      console.log("Insufficient balance to withdraw:", newAmount);
      return;
    }
    
    // Send the transaction
    const signedTx = await account.signTransaction(tx_params);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    const pre_gas = max_priority_fee_per_gas * BigInt(estimatedGas); // a BigInt in wei
    return [receipt, pre_gas];
  } catch (error) {
    console.error("An error occurred while preparing or sending the transaction:", error.message);
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

      const amount_in_wei = balance - BigInt(min_eth / 2);
      const amountInEther = web3.utils.fromWei(amount_in_wei.toString(), 'ether');

      const number_amount = Number(amountInEther);
      
      console.log(`\n${indexTnx + 1}. Deposit...`, convertWeiToNumber(amount_in_wei), "ETH to WETH");
      await new Promise((resolve) => setTimeout(resolve, 5000));
      [receipt, pre_gas] = await deposit(SM_USE, chainID, amountInEther, account, MAX_GAS);      
      await new Promise((resolve) => setTimeout(resolve, 5000));
      
      if (receipt !== undefined) {
        fee = await getTransactionFee(receipt.transactionHash);
      }
      
      return [ status, fee, Number(amountInEther) ];
    } else {

      const balanceOf = await SM_USE.methods.balanceOf(account.address).call();
      
      console.log(`\n${indexTnx + 1}. Withdraw...`, convertWeiToNumber(balanceOf), "WETH to ETH");
      await new Promise((resolve) => setTimeout(resolve, 5000));
      [receipt, pre_gas] = await withdraw(SM_USE, chainID, balanceOf, account, MAX_GAS);
      await new Promise((resolve) => setTimeout(resolve, 5000));

      if (receipt !== undefined) {
        fee = await getTransactionFee(receipt.transactionHash);
      }
      // fee = receipt !== undefined ? await getTransactionFee(receipt.transactionHash) : 0n;
      // if (fee === 0n) {
      //   console.log("Receipt of transaction is undefined");
      //   await new Promise((resolve) => setTimeout(resolve, 30000)); // wait to rpc node update
      //   fee = receipt !== undefined ? await getTransactionFee(receipt.transactionHash) : pre_gas;
      // }
      
      return [ status, fee, 0 ];
    }
  } catch (err) {
    console.log("Transaction failed:", err.message);

    // Xu ly Transaction not found 
    if (err.message.includes("Transaction not found")) {
      await new Promise((resolve) => setTimeout(resolve, 30000)); // wait to rpc node update
      fee = receipt !== undefined ? await getTransactionFee(receipt.transactionHash) : pre_gas;
    }
    if (fee == 0n) {
      status = false;
      amount = 0;
    }

    return { status, fee, amount};
  }
}

/**
 * 
 * @param {BigInt} ceil_gas - The ceil of gas in wei
 */
async function poolingGas(ceil_gas){
  let gas_price = 0n;
  let time_count = 0;
  while (true) {
    gas_price = await handleError(web3.eth.getGasPrice());
    if (gas_price != 0n && gas_price <= ceil_gas)
      return gas_price

    await new Promise((resolve) => setTimeout(resolve, 1000));
    time_count++;
    
    if(time_count % 60 == 0){
      console.log(".......Wait next 60s to lower GAS.")
    }
  }
}

module.exports = {
  handleError,
  cancelTransaction,
  getPrice,
  deposit,
  withdraw,
  DepositOrWithdraw,
  convertWeiToNumber,
  getTransactionFee,
  poolingGas,
  logMessage
};