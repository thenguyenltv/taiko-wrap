const { Web3 } = require('web3');

const {
  handleError,
  logMessage,
  convertWeiToNumber,
  getPrice,
  DepositOrWithdraw,
} = require('./utils');

const { 
  CEIL_GAS,
  SM_ADDRESS, 
  SM_ABI, 
  TEST_SM_WETH, 
  TEST_ABI_WETH,
  Mainnet,
  Testnet
} = require('./constant');



/**
 * Chon smart contract muon su dung (NOT WORK)
 * 0. SM_WRAP     : weth mang MAINNET
 * 1. TEST_SM_WRAP: weth mang TESTNET
 */
const IsMainnet = 1;

const PRIK = process.env.KEY;
let RPC_URL = IsMainnet === 1 ? process.env.RPC_URL : "https://rpc.hekla.taiko.xyz";
const TOTAL_POINT = process.argv[2];

const web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL));
const SM_WRAP = new web3.eth.Contract(SM_ABI, SM_ADDRESS);
const TEST_SM_WRAP = new web3.eth.Contract(TEST_ABI_WETH, TEST_SM_WETH);
const account = web3.eth.accounts.privateKeyToAccount(PRIK);


const SM_USE = IsMainnet === 1 ? SM_WRAP : TEST_SM_WRAP;
const chainID = IsMainnet === 1 ? Mainnet : Testnet; // not using now, so always run in mainnet (BE CAREFULL)

const MIN_BALANCE = 0.0004; // ETH units, the minimum balance to keep in the account

console.log("o __________________ WRAP  _________________");
console.log("o Run on", chainID);
console.log("o SM:", SM_USE._address);

console.log("o -------------------------------------------")
console.log("o", account.address);
console.log("o POINT: ", TOTAL_POINT);
console.log("o -------------------------------------------\n");


async function startTransactions(SM_USE, chainID, account, MIN_BALANCE, TOTAL_POINT) {
  const StartNonce = await handleError(web3.eth.getTransactionCount(account.address));
  let current_point = 1, total_fee = 0;
  let tnx_count = 0;
  let delayFailedTime = 10000; // 1 minute
  let start = new Date().getTime();
  let eth_price = 0;

  while (true) {
    /** Stop Condition */
    if (current_point > TOTAL_POINT){
      const balance = await handleError(web3.eth.getBalance(account.address));
      const balance_in_eth = convertWeiToNumber(balance, 18, 5);

      if (balance_in_eth > MIN_BALANCE) {
        console.log(`\n==> ${account.address} - ${Number(total_fee.toPrecision(3))} ETH - ${current_point} Points\n`);
        logMessage(`${account.address} - ${Number(total_fee.toPrecision(3))} ETH - ${current_point} Points`);
        return;
      }
    }

    /* Try sending transaction */
    let status =  false, fee = 0n, amount = 0;
    try {
      [status, fee, amount] = await DepositOrWithdraw(SM_USE, chainID, tnx_count, account, MIN_BALANCE, CEIL_GAS);
      eth_price = await getPrice('ethereum');
      
    } catch (error) {
      console.error("Transaction failed or timed out:", error.message);
      eth_price = 3000; // Fallback price if fetching fails
      await new Promise((resolve) => setTimeout(resolve, 10000));

    }

    let end = new Date().getTime();
    let time = (end - start) / 1000;
    console.log("--> Time elapsed:", 
      Math.floor(time / 3600), "hour", 
      Math.floor(time % 3600 / 60), "minutes", 
      Math.round(time % 60 * 100) / 100, "seconds");
      
      if (status) {
        tnx_count++;
        current_point += Math.floor(1.5 * eth_price * amount);
        total_fee += convertWeiToNumber(fee, 18, 8);
        console.log("Fee:", convertWeiToNumber(fee, 18, 8), "- ETH:", eth_price, "- Current Point:", current_point);
    }
    else {
      /** Xu ly lenh fail --> goi ham cancelTransaction */
      await new Promise((resolve) => setTimeout(resolve, delayFailedTime));
      // check nonce if the transaction is still mine in delayFailedTime and have done
      const nonce = await handleError(web3.eth.getTransactionCount(account.address));
      if (nonce == StartNonce + BigInt(tnx_count+1)) {
        console.log("Continue to next transaction...");
        continue;
      }
      // Các dòng mã phía dưới sẽ không được thực hiện nếu điều kiện if ở trên đúng
      const latestGasPrice = await handleError(web3.eth.getGasPrice());
      console.log("Transaction failed, Start canceling transaction...");
      const receipt = await handleError(cancelTransaction(latestGasPrice, account));
      if (receipt) {
        console.log("Cancel transaction successfully");
      }
    }
  }
}

async function main() {
  await startTransactions(SM_USE, chainID, account, MIN_BALANCE, Number(TOTAL_POINT));
}

main();

/**
 * Change colors reference of text
 * @tutorial https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
 */
