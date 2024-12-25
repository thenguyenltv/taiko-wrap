/**
 * Set up the environment variables
 */
const PRIVATE_KEYS = [
  process.env.KEY1,
  process.env.KEY2,
  process.env.KEY3,
  process.env.KEY4,
  process.env.KEY5,
  process.env.KEY6,
].filter(Boolean); // Danh sách các private keys


let RPC_URL = process.env.RPC_URL;
RPC_URL = RPC_URL == undefined ? "https://rpc.hekla.taiko.xyz" : RPC_URL;
let TOTAL_POINT = Number(process.argv[2]);
const MAX_FEE = Number(process.argv[3]);

const {
  handleError,
  convertWeiToNumber,
  getPrice,
  shortAddress,
  logMessage,
  logElapsedTime
} = require('./utils');

const {
  CEIL_GAS,
  MIN_GAS_PRICE
} = require('./constant');

const { Web3 } = require('web3');
const readline = require('readline');

const {
  cancelTransaction,
  sendFunds,
  getLowGasPrice,
  DepositOrWithdraw,
} = require('./methods');

const {
  MIN_BALANCE,
  SM_ADDRESS,
  SM_ABI,
  TEST_SM_WETH,
  TEST_ABI_WETH,
  Mainnet,
  Testnet
} = require('./constant');
const { type } = require('os');

const web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL));

const SM_WRAP = new web3.eth.Contract(SM_ABI, SM_ADDRESS);
const TEST_SM_WRAP = new web3.eth.Contract(TEST_ABI_WETH, TEST_SM_WETH);

const IsTestnet = RPC_URL.includes("hekla") || RPC_URL.includes("testnet")
const SM_USE = IsTestnet === true ? TEST_SM_WRAP : SM_WRAP;
const chainID = IsTestnet === true ? Testnet : Mainnet;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function startTransactions(SM_USE, chainID, account) {

  let duraGasPrice = await getLowGasPrice(CEIL_GAS);

  const StartNonce = await handleError(web3.eth.getTransactionCount(account.address));
  let current_point = 1, current_fee = 0;
  let tnx_count = 0;
  let wait_10s = 10000; // unit (ms), 1000ms = 1s
  let start = new Date().getTime();
  let eth_price = 0;

  let typeTnx = -1; // 0: Deposit, 1: Withdraw

  await new Promise((resolve) => setTimeout(resolve, wait_10s / 2));

  while (true) {

    /* Try sending transaction */
    let status = false, fee = 0n, amount = 0, gasPrice = 200000002n;
    try {
      //get balance of account
      const balance = await handleError(web3.eth.getBalance(account.address));
      const balance_in_eth = convertWeiToNumber(balance, 18, 5);
      if (typeTnx === -1){
        if (balance_in_eth > MIN_BALANCE) {
          typeTnx = 0;
        } else {
          typeTnx = 1;
        }
      }

      // check if gasPrice is null or 0n
      if (gasPrice === null || gasPrice === undefined || gasPrice === 0n) {
        gasPrice = 200000002n;
      }
      duraGasPrice = gasPrice < MIN_GAS_PRICE ? MIN_GAS_PRICE : gasPrice;

      // ================== DepositOrWithdraw ==================
      [status, fee, amount, gasPrice] = await DepositOrWithdraw(typeTnx, SM_USE, chainID, tnx_count, account, duraGasPrice);
      // ================== DepositOrWithdraw ==================

      // check fee is number
      fee = fee === null ? 0n : fee;
      // check amount is positive number
      amount = amount === null ? 0 : amount;
      amount = amount < 0 ? 0 : amount;

      eth_price = await getPrice('ethereum');

    } catch (error) {
      eth_price = 3000; // Fallback price if fetching fails
      // await new Promise((resolve) => setTimeout(resolve, wait_10s / 2));
    }

    if (status) {
      tnx_count++;
      typeTnx = 1 - typeTnx;
      current_point += Math.floor(1.5 * eth_price * amount);
      if (typeof fee === 'bigint') {
        current_fee += convertWeiToNumber(fee, 18, 8);
      } else {
        console.error('Fee is not a BigInt:', fee);
      }
      console.log("Fee:", convertWeiToNumber(fee, 18, 8), "- Current Fee:", Number(current_fee.toPrecision(3)), "- Current Point:", current_point);
      await new Promise((resolve) => setTimeout(resolve, wait_10s));
    }
    else {
      /** Xu ly lenh fail --> goi ham cancelTransaction */
      await new Promise((resolve) => setTimeout(resolve, wait_10s));
      // check nonce if the transaction is still mine in wait_10s and have done
      const nonce = await handleError(web3.eth.getTransactionCount(account.address));
      if (nonce == StartNonce + BigInt(tnx_count + 1)) {
        console.log("Continue to next transaction...");

        // Cong 1 cho tnx_count
        try {
          tnx_count++;
          current_point += Math.floor(1.5 * eth_price * amount);
          if (typeof fee === 'bigint') {
            current_fee += convertWeiToNumber(fee, 18, 8);
          } else {
            console.error('Fee is not a BigInt:', fee);
          }
          console.log("(Maybe wrong) Fee:", convertWeiToNumber(fee, 18, 8), "- Current Fee:", Number(current_fee.toPrecision(3)), "- Current Point:", current_point);

        } catch (error) {
          console.error("Fee or point may not increase");
        }
        // await new Promise((resolve) => setTimeout(resolve, wait_10s));
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
    const [hours, minutes, seconds] = logElapsedTime(start);
    console.log(
      `--> Time elapsed: ${hours}h${minutes}m${seconds}s`
    );

    /** Stop Condition 
     * 1. Đạt được số điểm tối đa
     * 2. Phí giao dịch vượt quá giới hạn
     * 3. Lượt cuối cùng phải là withdraw (để có số dư ETH > Min_Balance)
    */
    if ((TOTAL_POINT > 0 && current_point > TOTAL_POINT) || current_fee > MAX_FEE) {
      const balance_in_eth = convertWeiToNumber(await handleError(web3.eth.getBalance(account.address)), 18, 5);
      try {
        if (balance_in_eth > MIN_BALANCE) {
          const currentTime = new Date();
          currentTime.setHours(currentTime.getHours() + 7);
          const shortDate = currentTime.toISOString().replace('T', ' ').substring(0, 19);
          console.log(
            `\n==> [${shortDate}] ${account.address} - ${Number(current_fee.toPrecision(3))} fee - ${current_point} Points\n`
          );

          const [hours, minutes, _] = logElapsedTime(start);
          logMessage(
            `${shortAddress(account.address)} - ${tnx_count} txs - ${Number(current_fee.toPrecision(3))} fee - ${current_point} Points - ${hours}h${minutes}m`
          );

          return;
        }
      } catch (error) {
        console.error('An error occurred:', error);
      }
    }
  }
}

const processWallet = async (account) => {
  console.log(`\nProcessing wallet: ${account.address}`);
  await startTransactions(SM_USE, chainID, account);
};

async function main() {

  const WAIT_TIME = 60000;

  if (PRIVATE_KEYS.length === 0) {
    console.error("No private keys provided. Please set the environment variables.");
    process.exit(1); // Dừng chương trình nếu không có private key nào hợp lệ
  }

  const ACCOUNTS = PRIVATE_KEYS.map(key => web3.eth.accounts.privateKeyToAccount(key));

  if (ACCOUNTS.length === 0) {
    console.error("No valid accounts found. Please check your private keys.");
    process.exit(1);
  }

  console.log(`Found ${ACCOUNTS.length} account(s)\n`);
  for (let i = 0; i < ACCOUNTS.length; i++) {
    console.log(`Account ${i + 1}: ${ACCOUNTS[i].address}`);
  }
  console.log("o __________________ WRAP  _________________");
  console.log("o Run on", chainID);
  console.log("o SM:", SM_USE._address);
  console.log("o RPC:", RPC_URL);
  console.log("o POINT: ", TOTAL_POINT, "- MAX FEE: ", MAX_FEE);

  const runProcess = async () => {
    for (let i = 0; i < ACCOUNTS.length; i++) {
      const currentAccount = ACCOUNTS[i];
      const nextAccount = ACCOUNTS[(i + 1) % ACCOUNTS.length]; // Tài khoản tiếp theo (xoay vòng nếu hết danh sách)

      await processWallet(currentAccount);

      const balance = await handleError(web3.eth.getBalance(currentAccount.address));
      // = 99,7% balance

      let amount_to_send = web3.utils.fromWei(((balance * 998n) / 1000n).toString(), 'ether');
      // let amount_to_send = AMOUNT_TO_SEND;
      console.log(`Sending ${amount_to_send} ETH to the next wallet...`);

      if (ACCOUNTS.length > 1) {
        console.log(`Sending funds to the next wallet: ${nextAccount.address}`);

        let balance = await web3.eth.getBalance(currentAccount.address);
        const minEthBalance = BigInt(web3.utils.toWei('0.01', 'ether'));
        while (balance > minEthBalance) {
          try {
            await sendFunds(currentAccount, nextAccount.address, amount_to_send);
          } catch (error) {
            console.error("Error sending funds:", error);
          }
        }
      }

      console.log(`Waiting ${WAIT_TIME / 1000}s before processing the next wallet...`);
      await new Promise(resolve => setTimeout(resolve, WAIT_TIME));
    }

    console.log("All wallets processed.");
  };

  const autoRun = async () => {
    console.log("\nQuá thời gian chờ. Tự động chạy tool...");
    rl.close();
    await runProcess();
  };

  // Đặt timeout
  const timer = setTimeout(autoRun, WAIT_TIME);

  // Chờ xác nhận từ người dùng
  rl.question("\nConfirm to continue? (Y/n): ", async (answer) => {
    clearTimeout(timer); // Dừng timer nếu nhận được đầu vào từ người dùng
    const userInput = answer.trim().toLowerCase();
    if (userInput === "y" || userInput === "") {
      console.log("Let's GOOOOOOO");
      await runProcess();
    } else {
      console.log("Stopped.");
      rl.close();
    }
  });
}

main();

/**
 * Change colors reference of text
 * @tutorial https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
 */