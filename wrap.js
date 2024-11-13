const { Web3 } = require('web3');

const {
  handleError,
  cancelTransaction,
  getEthPrice,
  DepositOrWithdraw,
  roundNumber,
  getTransactionFee,
  poolingGas,
  logMessage
} = require('./utils');

const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

const { 
  ETH_PRICE,
  CEIL_GAS,
  SM_ADDRESS, 
  SM_ABI, 
  TEST_SM_WETH, 
  TEST_ABI_WETH,
  Mainnet,
  Testnet
} = require('./constant');

const RPC_URL = process.env.RPC_URL;
const PRIK = process.env.KEY;
const TOTAL_POINT = process.argv[2];

const web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL));
const SM_WRAP = new web3.eth.Contract(SM_ABI, SM_ADDRESS);
const TEST_SM_WRAP = new web3.eth.Contract(TEST_ABI_WETH, TEST_SM_WETH);

/**
 * Chon smart contract muon su dung (NOT WORK)
 * 0. SM_WRAP     : weth mang mainnet
 * 1. TEST_SM_WRAP: weth mang testnet
 */
const _chooseSM = 0;
const SM_USE = _chooseSM === 0 ? SM_WRAP : SM_WRAP;
const chainID = _chooseSM === 0 ? Mainnet : Testnet; // not using now, so always run in mainnet (BE CAREFULL)

const account = web3.eth.accounts.privateKeyToAccount(PRIK);

const MIN_BALANCE = 0.0004; // ETH units, the minimum balance to keep in the account

console.log("o __________________ WRAP  _________________");
console.log("o", account.address);
logMessage(`Address: ${account.address}`);
console.log("o POINT: ", TOTAL_POINT);
console.log("o ---------------------------------------------\n");

async function main() {
  
  startTransactions();
  
  async function startTransactions() {
    
    // Tinh so luong transaction {num_tnx} can gui de full diem
    let balance = await handleError(web3.eth.getBalance(account.address));
    balance = Number(web3.utils.fromWei(balance.toString(), 'ether'));
    let num_tnx = Math.ceil(TOTAL_POINT / (1.5 * ETH_PRICE *  balance)) * 2;
    console.log("\nStart auto wrap/unwrap", num_tnx, "times");

    let gasPrice = await poolingGas(CEIL_GAS);
    console.log("Gas Price:", gasPrice);
    
    const StartNonce = await handleError(web3.eth.getTransactionCount(account.address));
    let total_fee = 0;
    let countFailed = 0, countSuccess = 0;
    let tnx_count = 0;
    let delayFailedTime = 10000; // 1 minute
    let start = new Date().getTime();

    while (tnx_count < num_tnx) {
      if (tnx_count === num_tnx - 1){
        balance = await handleError(web3.eth.getBalance(account.address));
        if (balance > BigInt(web3.utils.toWei(MIN_BALANCE.toString(), 'ether'))) {
          num_tnx += 1;
        }
      }
      let resultTxn = { status: false, fee: 0n };

      try {
        resultTxn = await DepositOrWithdraw(SM_USE, tnx_count, account, MIN_BALANCE, CEIL_GAS);
      } catch (error) {
        console.error("Transaction failed or timed out:", error.message);
      }

      let end = new Date().getTime();
      let time = (end - start) / 1000;
      console.log("--> Time elapsed:", Math.floor(time / 60), "minutes", Math.round(time % 60 * 100) / 100, "seconds");
      
      if (resultTxn.status) {
        tnx_count++;
        countSuccess++;
        countFailed = 0;
        total_fee += roundNumber(resultTxn.fee, 18, 8);
        console.log("Waiting for the next transaction...", total_fee);
      }
      else {
        countFailed++;
        countSuccess = 0;

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
    console.log("\nTotal transactions completed:", tnx_count);
    logMessage(`\nTotal transactions completed: ${tnx_count}`);
    console.log("Total fee elapsed:", total_fee);
    logMessage(`Total fee elapsed: ${total_fee}`, "\n");
  }
}

main();

/**
 * Change colors reference of text
 * @tutorial https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
 */
