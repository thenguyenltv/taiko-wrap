const { Web3 } = require('web3');
const readline = require('readline');

const {
  handleError,
  logMessage,
  convertWeiToNumber,
  getPrice,
  logElapsedTime
} = require('./utils');

const {
  cancelTransaction,
  DepositOrWithdraw,
} = require('./methods');

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

const MIN_BALANCE = 0.0006; // ETH units, the minimum balance to keep in the account

console.log("o __________________ WRAP  _________________");
console.log("o Run on", chainID);
console.log("o SM:", SM_USE._address);
console.log("o RPC:", RPC_URL);

console.log("o -------------------------------------------")
console.log("o", account.address);
console.log("o POINT: ", TOTAL_POINT);
console.log("o -------------------------------------------\n");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});



async function startTransactions(SM_USE, chainID, account, MIN_BALANCE, TOTAL_POINT) {
  const StartNonce = await handleError(web3.eth.getTransactionCount(account.address));
  let current_point = 0, total_fee = 0;
  let tnx_count = 0;
  let delayFailedTime = 10000; // unit (ms), 1000ms = 1s
  let start = new Date().getTime();
  let eth_price = 0;

  while (true) {
    /** Stop Condition */
    if (current_point > TOTAL_POINT) {
      // const balance = await handleError(web3.eth.getBalance(account.address));
      // const balance_in_eth = convertWeiToNumber(balance, 18, 5);
      const balance_in_eth = convertWeiToNumber(await handleError(web3.eth.getBalance(account.address)), 18, 5);

      if (balance_in_eth > MIN_BALANCE) {
        console.log(`\n==> ${account.address} - ${Number(total_fee.toPrecision(3))} ETH - ${current_point} Points\n`);
        logMessage(`${account.address} - ${Number(total_fee.toPrecision(3))} ETH - ${current_point} Points`);
        return;
      }
    }

    /* Try sending transaction */
    let status = false, fee = 0n, amount = 0;
    try {
      [status, fee, amount] = await DepositOrWithdraw(SM_USE, chainID, tnx_count, account, MIN_BALANCE, CEIL_GAS);
      eth_price = await getPrice('ethereum');

    } catch (error) {
      eth_price = 3000; // Fallback price if fetching fails
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    if (status) {
      tnx_count++;
      current_point += Math.floor(1.5 * eth_price * amount);
      total_fee += convertWeiToNumber(fee, 18, 8);
      console.log("Fee:", convertWeiToNumber(fee, 18, 8), "- ETH:", eth_price, "- Current Point:", current_point);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    else {
      /** Xu ly lenh fail --> goi ham cancelTransaction */
      await new Promise((resolve) => setTimeout(resolve, delayFailedTime * 4));
      // check nonce if the transaction is still mine in delayFailedTime and have done
      const nonce = await handleError(web3.eth.getTransactionCount(account.address));
      if (nonce == StartNonce + BigInt(tnx_count + 1)) {
        console.log("Continue to next transaction...");

        // Cong 1 cho tnx_count
        try {
          tnx_count++;
          current_point += Math.floor(1.5 * eth_price * amount);
          total_fee += convertWeiToNumber(fee, 18, 8);
          console.log("(Maybe wrong) Fee:", convertWeiToNumber(fee, 18, 8), "- ETH:", eth_price, "- Current Point:", current_point);
        } catch (error) {
          console.error("Fee or point may not increase");
        }
        await new Promise((resolve) => setTimeout(resolve, delayFailedTime));
      }

      /** Send `Cancel Transaction`  */
      // // Các dòng mã phía dưới sẽ không được thực hiện nếu điều kiện if ở trên đúng
      // const latestGasPrice = await handleError(web3.eth.getGasPrice());
      // console.log("Transaction failed, Start canceling transaction...");
      // const receipt = await handleError(cancelTransaction(latestGasPrice, account));
      // if (receipt) {
      //   console.log("Cancel transaction successfully");
      // }
    }

    /* Print the time consumed */
    logElapsedTime(start);
  }
}

async function main() {

  const timeout = 60000;

  // Tự động chạy nếu hết thời gian
  const autoRun = async () => {
    console.log("\nKhông nhận được phản hồi. Tự động chạy tool...");
    rl.close();
    await startTransactions(SM_USE, chainID, account, MIN_BALANCE, Number(TOTAL_POINT));
  };

  // Đặt timeout
  const timer = setTimeout(autoRun, timeout);

  // Chờ xác nhận từ người dùng
  rl.question("Bạn có muốn chạy tool không? (Nhấn Y/y để chạy, bỏ qua sau 1 phút sẽ tự động chạy): ", async (answer) => {
    clearTimeout(timer); // Dừng timer nếu nhận được đầu vào từ người dùng
    const userInput = answer.trim().toLowerCase();
    if (userInput === "y" || userInput === "") {
      console.log("Chạy tool...");
      await startTransactions(SM_USE, chainID, account, MIN_BALANCE, Number(TOTAL_POINT));
    } else {
      console.log("Hủy bỏ bởi người dùng.");
    }
    rl.close();
  });
}

main();

/**
 * Change colors reference of text
 * @tutorial https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
 */
