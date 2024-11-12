const { Web3, types } = require('web3');

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.RPC_URL));

const { 
  LOG_FILE,
  Mainnet,
  Testnet
} = require('./constant');

const fs = require('fs');
const path = require('path');

// Define the log file path
const logFilePath = path.join(__dirname, LOG_FILE);

/**
 * Function to log messages to the file
 * @param {*} message 
 */
function logMessage(message) {
  const timestamp = new Date().toISOString(); // Add a timestamp
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
function roundNumber(num, decimal = 18, to = 5) {
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
async function getEthPrice() {
  const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
  const data = await response.json();
  return data.ethereum.usd;
}

/**
 * @param amount the amount (in Ether) of ETH to deposit
 * 
 * Function to deposit funds to the wrapped token contract
 */
async function deposit(SM_USE, amount, account, MAX_GAS) {
  try {
    // Prepare the transaction
    const amountInEther = web3.utils.fromWei(amount, 'ether');
    // const gasPrice = (await web3.eth.getGasPrice()) * BigInt(100 + GAS_FEE_INCREASE_PERCENT) / BigInt(100);
    const estimatedGas = await SM_USE.methods.deposit(amountInEther).estimateGas();
    const gas_limit = estimatedGas * BigInt(15) / BigInt(10);
    const nonce = await web3.eth.getTransactionCount(account.address, 'pending');
    const txData = SM_USE.methods.deposit(amountInEther).encodeABI();

    const gas_price = await poolingGas(MAX_GAS);
    // const gas_price = 180000002n;
    const max_priority_fee_per_gas = gas_price * BigInt(100 + 1) / BigInt(100);
    const max_fee_per_gas = web3.utils.toWei('0.25', 'gwei');

    /** Transaction type 2 */
    const tx_params = {
      nonce,
      from: account.address,
      to: SM_USE.options.address,
      value: amount,
      data: txData,
      maxPriorityFeePerGas: max_priority_fee_per_gas,
      maxFeePerGas: max_fee_per_gas,
      gasLimit: gas_limit,
      type: '0x2',
      chainID: Mainnet
    };

    // double check the balance
    await new Promise((resolve) => setTimeout(resolve, 1000)); 
    const balance = await web3.eth.getBalance(account.address);
    if (balance < amount) {
      console.log("Insufficient balance to deposit:", amount);
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
async function withdraw(SM_USE, amount, account, MAX_GAS) {
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
      chainID: Mainnet
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
 * loop deposit and withdraw
 */
async function DepositOrWithdraw(SM_USE, indexTnx, account, MIN_BALANCE, MAX_GAS) {
  const min_eth = web3.utils.toWei(MIN_BALANCE.toString(), 'ether');
  let status = true;
  let fee = 0n;

  try {
    const balance = await web3.eth.getBalance(account.address);

    if (balance > min_eth) {

      const amount = balance - BigInt(min_eth / 2);
      
      console.log(`\n${indexTnx + 1}. Deposit...`, roundNumber(amount), "ETH to WETH");
      const [receipt, pre_gas] = await deposit(SM_USE, amount, account, MAX_GAS);
      
      await new Promise((resolve) => setTimeout(resolve, 5000));
      
      fee = receipt !== undefined ? await getTransactionFee(receipt.transactionHash) : 0n;
      if (fee === 0n) {
        console.log("Receipt of transaction is undefined");
        await new Promise((resolve) => setTimeout(resolve, 30000)); // wait to rpc node update
        fee = receipt !== undefined ? await getTransactionFee(receipt.transactionHash) : pre_gas;
      }
      console.log("Fee:", roundNumber(fee, 18, 8));
      
      return { status, fee };
    } else {

      const balanceOf = await SM_USE.methods.balanceOf(account.address).call();
      
      console.log(`\n${indexTnx + 1}. Withdraw...`, roundNumber(balanceOf), "WETH to ETH");
      const [receipt, pre_gas] = await withdraw(SM_USE, balanceOf, account, MAX_GAS);
      
      await new Promise((resolve) => setTimeout(resolve, 5000));

      fee = receipt !== undefined ? await getTransactionFee(receipt.transactionHash) : 0n;
      if (fee === 0n) {
        console.log("Receipt of transaction is undefined");
        await new Promise((resolve) => setTimeout(resolve, 30000)); // wait to rpc node update
        fee = receipt !== undefined ? await getTransactionFee(receipt.transactionHash) : pre_gas;
      }
      console.log("Fee:", roundNumber(fee, 18, 8));
      
      return { status, fee };
    }
  } catch (err) {
    console.log("Transaction failed:", err.message);

    // Xu ly Transaction not found 
    if (err.message.includes("Transaction not found")) {
      await new Promise((resolve) => setTimeout(resolve, 30000)); // wait to rpc node update
      fee = receipt !== undefined ? await getTransactionFee(receipt.transactionHash) : 0n;
      
      if (fee == 0n) status = false;
    }

    return { status, fee };
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
  getEthPrice,
  deposit,
  withdraw,
  DepositOrWithdraw,
  roundNumber,
  getTransactionFee,
  poolingGas,
  logMessage
};