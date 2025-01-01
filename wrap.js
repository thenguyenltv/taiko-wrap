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
  process.env.KEY7,
  process.env.KEY8,
  process.env.KEY9,
  process.env.KEY10,
].filter(Boolean); // Danh sách các private keys


let RPC_URL = process.env.RPC_URL;
RPC_URL = RPC_URL == undefined ? "https://rpc.hekla.taiko.xyz" : RPC_URL;
const SUB_RPC1 = process.env.SUB_RPC1;
const SUB_RPC2 = process.env.SUB_RPC2;
const ListRPC = [RPC_URL];
let TOTAL_POINT = Number(process.argv[2]);
const MAX_FEE = Number(process.argv[3]);
const MIN_GAS = Number(process.argv[4]);

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
  getLowGasPrice,
  checkFinality,
  checkBalanceAndSetWithdraw,
  sendFunds,
  cancelTransaction,
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

let web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL));

const SM_WRAP = new web3.eth.Contract(SM_ABI, SM_ADDRESS);
const TEST_SM_WRAP = new web3.eth.Contract(TEST_ABI_WETH, TEST_SM_WETH);

const IsTestnet = RPC_URL.includes("hekla") || RPC_URL.includes("testnet")
const SM_USE = IsTestnet === true ? TEST_SM_WRAP : SM_WRAP;
const chainID = IsTestnet === true ? Testnet : Mainnet;
const WAIT_60S = 60000;

const min_gwei = (MIN_GAS !== undefined && !isNaN(MIN_GAS)) ? BigInt(MIN_GAS * 10 ** 9) : MIN_GAS_PRICE;
console.log("Min Gas Price:", web3.utils.fromWei(min_gwei.toString(), 'gwei'), "Gwei");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function startTransactions(SM_USE, chainID, account) {

  let duraGasPrice = await handleError(web3.eth.getGasPrice());

  const StartNonce = await handleError(web3.eth.getTransactionCount(account.address));
  let current_point = 1, current_fee = 0;
  let tnx_count = 0, failed_tnx_count = 0;
  let wait_10s = 10000; // unit (ms), 1000ms = 1s
  let start = new Date().getTime();
  let eth_price = 0;

  let isTnxWithdraw = -1; // 0: Deposit, 1: Withdraw

  await new Promise((resolve) => setTimeout(resolve, wait_10s / 2));

  while (true) {

    /** Stop Condition 
         * 1. Đạt được số điểm tối đa
         * Or Phí giao dịch vượt quá giới hạn
         * 2. Lượt cuối cùng phải là withdraw (để có số dư ETH > Min_Balance)
        */
    if ((TOTAL_POINT > 0 && current_point >= TOTAL_POINT) || current_fee >= MAX_FEE) {
      const balance_in_eth = convertWeiToNumber(await handleError(web3.eth.getBalance(account.address)), 18, 5);
      try {
        if ((balance_in_eth > MIN_BALANCE && isTnxWithdraw === 0) || tnx_count === 0) {
          const currentTime = new Date();
          currentTime.setHours(currentTime.getHours() + 7);
          const shortDate = currentTime.toISOString().replace('T', ' ').substring(0, 19);
          console.log(
            `\n==> [${shortDate}] ${shortAddress(account.address)} - ${Number(current_fee.toPrecision(3))} fee - ${current_point} Points\n`
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

    /* Try sending transaction */
    let status = false, fee = 0n, amount = 0
    let gasPrice = await getLowGasPrice(CEIL_GAS);
    try {
      console.log(`~~~~~~~~~~~~~~Start wrap/unwrap of ${shortAddress(account.address)}`)
      const balance = await handleError(web3.eth.getBalance(account.address));
      const balance_in_eth = convertWeiToNumber(balance, 18, 5) - (MIN_BALANCE / 2);
      if (isTnxWithdraw === -1) {
        if (balance_in_eth > MIN_BALANCE) {
          isTnxWithdraw = 0; // Deposit
        } else {
          isTnxWithdraw = 1; // Withdraw
        }
      }

      // check if gasPrice is null or 0n
      if (gasPrice === null || gasPrice === undefined || gasPrice === 0n) {
        gasPrice = 200000002n;
      }
      duraGasPrice = gasPrice < min_gwei ? min_gwei : gasPrice;
      console.log("~~~~~~~~~~~~~~Gas Price:", web3.utils.fromWei(duraGasPrice.toString(), 'gwei'), "Gwei");

      // ================== DepositOrWithdraw ==================
      [status, fee, amount, gasPrice] = await DepositOrWithdraw(isTnxWithdraw, SM_USE, chainID, tnx_count, account, duraGasPrice);
      // ================== DepositOrWithdraw ==================

      // check fee is number
      fee = fee === null ? 0n : fee;
      // check amount is positive number
      amount = amount === null ? 0 : amount;
      amount = amount < 0 ? 0 : amount;

      eth_price = await getPrice('ethereum');

    } catch (error) {
      eth_price = 3000; // Fallback price if fetching fails
    }

    if (status) {
      tnx_count++;
      failed_tnx_count = 0;
      isTnxWithdraw = 1 - isTnxWithdraw;
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

      await new Promise((resolve) => setTimeout(resolve, wait_10s));
      // check nonce if the transaction is still mine in wait_10s and have done
      const nonce = await handleError(web3.eth.getTransactionCount(account.address));
      if (nonce == StartNonce + BigInt(tnx_count + 1)) {
        console.log("Continue to next transaction...");
        // Cong 1 cho tnx_count
        try {
          tnx_count++;
          isTnxWithdraw = 1 - isTnxWithdraw;
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
      }
      else { /** Xu ly lenh fail --> goi ham cancelTransaction */
        failed_tnx_count++;
        console.log("Number of failed transactions:", failed_tnx_count, "If it is greater than 5, the transaction will be canceled");
        if (failed_tnx_count > 5) {

          // check isTnxWithdraw again
          let tmpIsWithdraw = await checkBalanceAndSetWithdraw(account);
          if (tmpIsWithdraw !== isTnxWithdraw) {
            // check in 1 minute
            await new Promise((resolve) => setTimeout(resolve, wait_10s * 6));
            tmpIsWithdraw = await checkBalanceAndSetWithdraw(account);
            isTnxWithdraw = tmpIsWithdraw;
          }

          /** Send `Cancel Transaction` */
          const latestGasPrice = await handleError(web3.eth.getGasPrice());
          const receipt = await handleError(cancelTransaction(latestGasPrice, account));
          if (receipt) {
            console.log("Cancel transaction successfully");
            tnx_count++;
            failed_tnx_count = 0;
            await new Promise((resolve) => setTimeout(resolve, wait_10s * 3));
          }

          web3 = new Web3(new Web3.providers.HttpProvider(ListRPC[Math.floor(Math.random() * ListRPC.length)]));
          console.log("Switch to RPC:", web3.providers);

        }
        await new Promise((resolve) => setTimeout(resolve, wait_10s));
      }
    }

    /* Print the time consumed */
    const [hours, minutes, seconds] = logElapsedTime(start);
    console.log(
      `--> Time elapsed: ${hours}h${minutes}m${seconds}s\n`
    );
  }
}

const processWallet = async (account) => {
  console.log(`\nProcessing wallet: ${account.address}`);
  await startTransactions(SM_USE, chainID, account);
};

async function runProcess(ACCOUNTS) {
  for (let i = 0; i < ACCOUNTS.length; i++) {
    const currentAccount = ACCOUNTS[i];
    const nextAccount = ACCOUNTS[(i + 1) % ACCOUNTS.length]; // Tài khoản tiếp theo (xoay vòng nếu hết danh sách)
    
    // check account first
    const ether = convertWeiToNumber(await handleError(web3.eth.getBalance(currentAccount.address)));
    const wrap_ether = convertWeiToNumber(await handleError(SM_USE.methods.balanceOf(currentAccount.address).call()));
    console.log("Current Account:", shortAddress(currentAccount.address), "- Balance:", ether, "- WETH:", wrap_ether);
    await processWallet(currentAccount);

    await new Promise(resolve => setTimeout(resolve, WAIT_60S / 2));

    /** Send fund to next wallet 
     * 1. aoumnt_to_send = 99,7% balance
     * 2. Kiểm tra tính đúng đắn
     * 2.1 Giao dịch có transactionHash, fee
     * 2.2 Balance của nextAccount >= amount_to_send
     */
    const balance = await handleError(web3.eth.getBalance(currentAccount.address));
    if (ACCOUNTS.length > 1) {
      while (true) {
        let currentBalance = await handleError(web3.eth.getBalance(currentAccount.address));
        let nextBalance = await handleError(web3.eth.getBalance(nextAccount.address));

        let fee;

        // amount_to_send = 99,7% balance
        let wei_to_send = balance - 500000000000000n; // decrease 0.0005 ETH
        console.log("Balance", convertWeiToNumber(balance), "- amou to send:", convertWeiToNumber(wei_to_send));
        let amount_in_eth = Number(web3.utils.fromWei(wei_to_send.toString(), 'ether'));

        // Stop if done before
        if (currentBalance < balance - wei_to_send && nextBalance >= wei_to_send) {
          console.log(`Send fund successfully`);
          break;
        }

        // not run if done before
        console.log(`Sending ${amount_in_eth.toPrecision(3)} to the next wallet: ${nextAccount.address}`);
        try {
          const receipt = await sendFunds(currentAccount, nextAccount.address, amount_in_eth);
          console.log(`Transaction hash: ${receipt.transactionHash}`);
          fee = await checkFinality(receipt);
          // check until balance of WETH >= amount_in_wei
          async () => {
            while (currentBalance < balance - wei_to_send && nextBalance >= wei_to_send) {
              await new Promise((resolve) => setTimeout(resolve, WAIT_60S / 30));
              currentBalance = await web3.eth.getBalance(currentAccount.address);
              nextBalance = await web3.eth.getBalance(nextAccount.address);
            }
          }

          if (receipt) {
            console.log(`Send successfully. Fee: ${fee}`);
            console.log(`Waiting ${WAIT_60S / 2000}s before processing the next wallet...`);
            await new Promise(resolve => setTimeout(resolve, WAIT_60S / 2));
            break;
          }
        } catch (error) {
          console.error("An error occurred while sending funds");
        }
      }
    }
  }
  console.log("All wallets processed.");
};

async function main() {
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

  const autoRun = async () => {
    console.log("\nQuá thời gian chờ. Tự động chạy tool...");
    rl.close();
    await runProcess(ACCOUNTS);
  };

  // Đặt timeout
  const timer = setTimeout(autoRun, WAIT_60S);

  // Chờ xác nhận từ người dùng
  rl.question("\nConfirm to continue? (Y/n): ", async (answer) => {
    clearTimeout(timer); // Dừng timer nếu nhận được đầu vào từ người dùng
    const userInput = answer.trim().toLowerCase();
    if (userInput === "y" || userInput === "") {
      console.log("Let's GOOOOOOO");
      await runProcess(ACCOUNTS);
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