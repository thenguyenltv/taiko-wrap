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
  process.env.KEY11,
  process.env.KEY12,
  process.env.KEY13,
  process.env.KEY14,
  process.env.KEY15,
].filter(Boolean); // Danh sách các private keys

const OKX_APIs = [
  process.env.OKX_API1,
  process.env.OKX_API2,
  process.env.OKX_API3,
  process.env.OKX_API4,
  process.env.OKX_API5,
  process.env.OKX_API6,
  process.env.OKX_API7,
  process.env.OKX_API8,
  process.env.OKX_API9,
  process.env.OKX_API10,
  process.env.OKX_API11,
  process.env.OKX_API12,
  process.env.OKX_API13,
  process.env.OKX_API14,
  process.env.OKX_API15,
].filter(Boolean); // Danh sách các API Key của OKX

const OKX_KEYs = [
  process.env.OKX_KEY1,
  process.env.OKX_KEY2,
  process.env.OKX_KEY3,
  process.env.OKX_KEY4,
  process.env.OKX_KEY5,
  process.env.OKX_KEY6,
  process.env.OKX_KEY7,
  process.env.OKX_KEY8,
  process.env.OKX_KEY9,
  process.env.OKX_KEY10,
  process.env.OKX_KEY11,
  process.env.OKX_KEY12,
  process.env.OKX_KEY13,
  process.env.OKX_KEY14,
  process.env.OKX_KEY15,
].filter(Boolean); // Danh sách các Secret Key của OKX

const OKX_PASSPHRASEs = [
  process.env.OKX_PASSPHRASE1,
  process.env.OKX_PASSPHRASE2,
  process.env.OKX_PASSPHRASE3,
  process.env.OKX_PASSPHRASE4,
  process.env.OKX_PASSPHRASE5,
  process.env.OKX_PASSPHRASE6,
  process.env.OKX_PASSPHRASE7,
  process.env.OKX_PASSPHRASE8,
  process.env.OKX_PASSPHRASE9,
  process.env.OKX_PASSPHRASE10,
  process.env.OKX_PASSPHRASE11,
  process.env.OKX_PASSPHRASE12,
  process.env.OKX_PASSPHRASE13,
  process.env.OKX_PASSPHRASE14,
  process.env.OKX_PASSPHRASE15,
].filter(Boolean); // Danh sách các Passpharase của OKX

let RPC_URL = process.env.RPC_URL;
RPC_URL = RPC_URL == undefined ? "https://rpc.hekla.taiko.xyz" : RPC_URL;
const SUB_RPC1 = process.env.SUB_RPC1;
const SUB_RPC2 = process.env.SUB_RPC2;
const ListRPC = [RPC_URL];
let MAX_POINT_WRAP = Number(process.argv[2]);
let MAX_POINT_VOTE = Number(process.argv[3]);
const MIN_GAS = Number(process.argv[4]);

const { Web3 } = require('web3');
const readline = require('readline');

const {
  handleError,
  convertWeiToNumber,
  getPrice,
  shortAddress,
  logMessage,
  logElapsedTime,
  sendEmail
} = require('./utils');

const {
  listNFT,
  CheckListNFT,
  signAndSubmitOrder,
  GetQueryListing,
  CheckQueryListing,
  PostBuyNFT,
  SignAndBuyNFT,
  BuyNFTOnOKX,
} = require('./OKX_NFT.js');

const {
  CEIL_GAS,
  MIN_GAS_PRICE,
  COLLECTION_ADDRESS,
  COUNT,
  CURRENCY_ADDRESS,
  PLATFORM,
} = require('./constant');

const constants = require('./constant');

const {
  getLowGasPrice,
  checkFinality,
  checkBalanceAndSetWithdraw,
  sendFunds,
  cancelTransaction,
  DepositOrWithdraw,
  tnxType2,
  ProcessTotalGas,
} = require('./methods');

const {
  MIN_BALANCE,
  CONTRACT_VOTE,
  ABI_VOTE,
  SM_ADDRESS,
  SM_ABI,
  TEST_SM_WETH,
  TEST_ABI_WETH,
  Mainnet,
  Testnet
} = require('./constant');

let web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL));

const SM_WRAP = new web3.eth.Contract(SM_ABI, SM_ADDRESS);
const TEST_SM_WRAP = new web3.eth.Contract(TEST_ABI_WETH, TEST_SM_WETH);

const IsTestnet = RPC_URL.includes("hekla") || RPC_URL.includes("testnet")
const SM_USE = IsTestnet === true ? TEST_SM_WRAP : SM_WRAP;
const chainID = IsTestnet === true ? Testnet : Mainnet;
const chain = chainID === Mainnet ? "taiko" : "Testnet";
const WAIT_25S = 25000;

const min_gwei = (MIN_GAS !== undefined && !isNaN(MIN_GAS)) ? BigInt(MIN_GAS * 10 ** 9) : MIN_GAS_PRICE;
console.log("Min Gas Price:", web3.utils.fromWei(min_gwei.toString(), 'gwei'), "Gwei");

// Vote constance
const MULTI_POINT = 2.12;
const SM_VOTE = new web3.eth.Contract(ABI_VOTE, CONTRACT_VOTE);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * @returns The result of process: [current_point, current_fee]
 */
async function startTransactions(SM_USE, chainID, account) {

  let duraGasPrice = await handleError(web3.eth.getGasPrice());

  const StartNonce = await handleError(web3.eth.getTransactionCount(account.address));
  let current_point = 0, current_fee = 0;
  let tnx_count = 0, failed_tnx_count = 0;
  let wait_10s = 10000; // unit (ms), 1000ms = 1s
  let start = new Date().getTime();
  let eth_price = 0;

  let isTnxWithdraw = -1; // 0: Deposit, 1: Withdraw
  let attempt_check_balance = 0;

  // Check balance of account
  while (attempt_check_balance < 5) {
    try {
      const etherBalance = await handleError(web3.eth.getBalance(account.address));
      const wrapBalance = await handleError(SM_USE.methods.balanceOf(account.address).call());
      const totalBalance = convertWeiToNumber(etherBalance + wrapBalance);
      if (totalBalance < MIN_BALANCE) {
        console.error("Balance is below MIN_BALANCE. Retrying...");
        await new Promise(r => setTimeout(r, wait_10s));
        if (attempt_check_balance >= 5)
          return [null, null];
      }
      else {
        console.log("Balance is enough to start the process");
        break;
      }
    } catch (error) {
      console.error("Error checking balance:", error.message);
      await new Promise(r => setTimeout(r, wait_10s));
    }
    attempt_check_balance++;
  }

  while (true) {

    /** Stop Condition 
       * 1. [Điểm vượt qua giới hạn] AND [Phí giao dịch vượt qua giới hạn]
       * 2. Lượt cuối cùng phải là withdraw (để có số dư ETH > Min_Balance)
      */
    if (current_point >= MAX_POINT_WRAP) {
      console.log("Check stop condition:", current_point, current_fee);
      await new Promise((resolve) => setTimeout(resolve, wait_10s));
      try {
        const balance_in_eth = convertWeiToNumber(await handleError(web3.eth.getBalance(account.address)), 18, 5);
        if ((balance_in_eth > MIN_BALANCE * 3 && isTnxWithdraw === 0) || tnx_count === 0) {
          console.log("Check the WETH, if > MIN_BALANCE, continue to withdraw");
          const balanceWETH = await handleError(SM_USE.methods.balanceOf(account.address).call());
          if (convertWeiToNumber(balanceWETH) > MIN_BALANCE) {
            isTnxWithdraw = 1;
            console.log("--> Withdraw the last WETH...");
          }
          else {
            console.log("Stop Wrap/Unwrap because of reaching the limit\n");
            return [current_point, current_fee];
          }
        }
        else {
          console.log("Continue to withdraw to have eth balance > MIN_BALANCE");
        }
      } catch (error) {
        console.error('An error occurred:', error);
      }
    }

    /* Try sending transaction */
    let status = false, fee = 0n, amount = 0
    try {
      let gasPrice = await getLowGasPrice(CEIL_GAS);

      if (gasPrice === null || gasPrice === undefined || gasPrice === 0n) {
        gasPrice = 20_000_002n;
      }
      duraGasPrice = gasPrice < min_gwei ? min_gwei : gasPrice;
      const gasPriceInNumber = +Number(web3.utils.fromWei(duraGasPrice, 'gwei')).toPrecision(2);
      console.log(`~~~~~~Start wrap/unwrap of ${shortAddress(account.address)}` +
        `, gas price ${gasPriceInNumber} Gwei`
      );

      const balance = await handleError(web3.eth.getBalance(account.address));
      const balance_in_eth = convertWeiToNumber(balance, 18, 5) - (MIN_BALANCE / 2);
      // First transaction
      if (isTnxWithdraw === -1) {
        if (balance_in_eth > MIN_BALANCE) {
          isTnxWithdraw = 0; // Deposit
        } else {
          isTnxWithdraw = 1; // Withdraw
        }
      }

      // ================== DepositOrWithdraw ==================
      await new Promise((resolve) => setTimeout(resolve, wait_10s / 2));
      [status, fee, amount, gasPrice] = await DepositOrWithdraw(isTnxWithdraw, SM_USE, chainID, tnx_count, account, duraGasPrice);
      // ================== DepositOrWithdraw ==================

      // check and update values
      fee = fee === null ? 0n : fee;
      amount = amount === null ? 0 : amount;
      amount = amount < 0 ? 0 : amount;
      eth_price = await getPrice('ethereum');
    } catch (error) {
      eth_price = 3000; // Fallback price if fetching fails
    }

    // check status of transaction
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
    }
    else {
      await new Promise((resolve) => setTimeout(resolve, wait_10s));
      // check nonce if the transaction is still mine in wait_10s and have done
      const nonce = await handleError(web3.eth.getTransactionCount(account.address));
      if (nonce == StartNonce + BigInt(tnx_count + 1)) {
        console.log("Continue to next transaction...");
        // After waiting 10s, transaction is successful
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

        console.log("Number of failed transactions:", failed_tnx_count, "If it is greater than 5, the transaction will be canceled");

        // Check Deposit or Withdraw is done?
        let tmpIsWithdraw = await checkBalanceAndSetWithdraw(account);
        if (tmpIsWithdraw !== isTnxWithdraw) {
          isTnxWithdraw = tmpIsWithdraw;
          console.log("Update isTnxWithdraw to", tmpIsWithdraw);
          tnx_count++;
          failed_tnx_count = 0;
        }
        else failed_tnx_count++;

        if (failed_tnx_count > 5) {
          // check isTnxWithdraw again, wait for something happen
          await new Promise((resolve) => setTimeout(resolve, wait_10s * 6));
          // let tmpIsWithdraw = await checkBalanceAndSetWithdraw(account);
          // if (tmpIsWithdraw !== isTnxWithdraw) {
          //   isTnxWithdraw = tmpIsWithdraw;
          //   console.log("Update isTnxWithdraw to", tmpIsWithdraw);
          //   tnx_count++;
          // }
          // else {
          //   /** Send `Cancel Transaction` */
          //   const receipt = await handleError(cancelTransaction(account, duraGasPrice));
          //   if (receipt) {
          //     console.log("Cancel transaction successfully");
          //     tnx_count++;
          //     failed_tnx_count = 0;
          //     await new Promise((resolve) => setTimeout(resolve, wait_10s));
          //   }

          // web3 = new Web3(new Web3.providers.HttpProvider(ListRPC[Math.floor(Math.random() * ListRPC.length)]));
          // console.log("Switch to RPC:", web3.providers);
        }
      }
    }
    isTnxWithdraw = await checkBalanceAndSetWithdraw(account);
  }

  /* Print the time consumed */
  const [hours, minutes, seconds] = logElapsedTime(start);
  console.log(
    `--> Time elapsed: ${hours}h${minutes}m${seconds}s\n`
  );
}

/**
 * This function is used to send 1 transaction to the voting contract
 * Just send, not waiting for the result
 */
async function InitializeVoting(NONCE, gasPrice, gasIncrease) {
  try {
    const encodedData = SM_VOTE.methods.vote().encodeABI();
    const estimatedGas = await web3.eth.estimateGas({
      to: CONTRACT_VOTE,
      data: encodedData,
    });
    const gas_Limit = web3.utils.toHex(estimatedGas) * 2;
    const max_Priority_Fee_Per_Gas = gasPrice * BigInt(100 + gasIncrease) / BigInt(100);
    const max_Fee_Per_Gas = web3.utils.toWei('0.25', 'gwei');

    /** EIP-1559 (Type 2 transaction) */
    const tx = {
      nonce: NONCE,
      to: CONTRACT_VOTE,
      data: encodedData,
      value: '0x00',
      maxPriorityFeePerGas: max_Priority_Fee_Per_Gas,
      maxFeePerGas: max_Fee_Per_Gas,
      gasLimit: gas_Limit,
      type: '0x2', // Specify EIP-1559 transaction type
    };


    const fee = web3.utils.fromWei((max_Priority_Fee_Per_Gas * BigInt(estimatedGas)).toString(), 'ether');
    return [tx, fee];
  }
  catch (error) {
    console.error('Error sending vote:', error.message);
    return [null, null];
  }
}

/** Voting method */
async function Voting(account, TOTAL_POINT = 300, TOTAL_GAS = 0) {

  // gwei / 10 * 2 = total_point
  // ==> gwei = total_point / 2 * 10
  // Do do, total_gas = gwei --> ether
  const TOTAL_GAS_In_Wei = web3.utils.toWei((Math.ceil(parseInt(TOTAL_POINT) / MULTI_POINT * 10)).toString(), 'Gwei');
  const total_gas = TOTAL_GAS_In_Wei === '0' ? TOTAL_GAS : Number(web3.utils.fromWei(TOTAL_GAS_In_Wei, 'ether'));
  console.log(`\nTotal Point: ${parseInt(TOTAL_POINT)}`);
  console.log("Total gas:", convertWeiToNumber(total_gas, 0, 6), "ETH");

  let TNX_PER_BATCH, GAS_FEE_INCREASE_PERCENT;

  let NONCE = await handleError(web3.eth.getTransactionCount(account.address));
  if (NONCE == null || NONCE == undefined) {
    console.log("Fetching error");
    return;
  }
  let startNonceRound = NONCE;

  // =============================== Start Voting ===============================
  let txCount = 0, remainingGas, gas_consumed = 0, Gas_Price;
  while (gas_consumed < Number(total_gas)) {
    Gas_Price = await handleError(web3.eth.getGasPrice());
    remainingGas = Number(total_gas) - gas_consumed;
    [TNX_PER_BATCH, GAS_FEE_INCREASE_PERCENT] = ProcessTotalGas(remainingGas, Gas_Price);

    console.log('\x1b[34m%s\x1b[0m', `\nSending ${TNX_PER_BATCH} transactions with NONCE start ${NONCE}...`);

    [tx, fee] = await InitializeVoting(NONCE, Gas_Price, GAS_FEE_INCREASE_PERCENT);
    if (tx == null || fee == null) {
      await new Promise(resolve => setTimeout(resolve, WAIT_25S / 5));
      continue;
    }

    // Send batch transactions
    for (let i = 0; i < TNX_PER_BATCH; i++) {
      try {
        tnxType2(account, tx);
        console.log(`Fee: ${convertWeiToNumber(fee, 0, 8)} ETH`);
        gas_consumed += parseFloat(fee);
        NONCE += BigInt(1);
        tx.nonce = NONCE;
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Sending Tnx Error:', error.message);
      }
    }

    // Wait for the transaction to be mined
    let nonce, j;
    for (j = 0; j < 60; j++) {
      nonce = await handleError(web3.eth.getTransactionCount(account.address));
      if (nonce >= startNonceRound + BigInt(TNX_PER_BATCH)) {
        console.log(`--> Done ${nonce - startNonceRound} transactions!!!`);
        console.log("--> Gas consumed:", convertWeiToNumber(gas_consumed, 0, 6), "ETH");
        break;
      }
      await new Promise(resolve => setTimeout(resolve, WAIT_25S / 10));
    }
    // last check
    if (j === 60) {
      await new Promise(resolve => setTimeout(resolve, WAIT_25S));
      console.log("Last check...");
      nonce = await handleError(web3.eth.getTransactionCount(account.address));
      if (nonce > startNonceRound + BigInt(TNX_PER_BATCH)) {
        console.log(`--> Done ${nonce - startNonceRound} transactions!!!`);
        console.log("--> Gas consumed:", convertWeiToNumber(gas_consumed, 0, 6), "ETH");
      }
    }

    txCount += Number(nonce - startNonceRound);
    NONCE = startNonceRound = nonce;
  }
  // =============================== End Voting ===============================

  return [TOTAL_POINT, total_gas]
}

const processWallet = async (account) => {
  let start = new Date().getTime();
  let pointsWrap = 0, feeWrap = 0, pointsVote = 0, feeVote = 0;

  console.log(`\nProcessing wallet: ${account.address}`);

  // ================ Start wrap/unwrap process ================
  await new Promise(resolve => setTimeout(resolve, WAIT_25S / 5));
  [pointsWrap, feeWrap] = await startTransactions(SM_USE, chainID, account);
  if (pointsWrap === null || feeWrap === null) {
    console.error("Error when wrap/unwrap process. Stop the process!!!");
    return null;
  }
  // ================ End wrap/unwrap process ================


  // Start Vote process if address end with 8f3, b400, c1d
  // ================ Start Vote process ================
  const last3Char = account.address.slice(-3).toUpperCase();
  if (last3Char === '8F3' || last3Char === '400' || last3Char === 'C1D') {
    console.log("Start voting process to earn Tnx Point...");
    await new Promise(resolve => setTimeout(resolve, WAIT_25S / 5));
    [pointsVote, feeVote] = await Voting(account, MAX_POINT_VOTE);
  }
  else {
    console.log(`This account ${shortAddress(account.address)} is not eligible for voting because of the last 3 characters: ${last3Char}`);
  }
  // ================ End Vote process ================

  const currentTime = new Date();
  currentTime.setHours(currentTime.getHours() + 7);

  const [hours, minutes, _] = logElapsedTime(start);
  const body = `${shortAddress(account.address)} - ` +
    `${Number(feeWrap.toPrecision(3))} FeeW - ${pointsWrap} P_W - ` +
    `${pointsVote} P_V - ${Number(feeVote.toPrecision(3))} FeeV - ` +
    `${hours}h${minutes}m`;
  console.log(body);
  logMessage(body);
  sendEmail(body, 'Taiko Wrap/Unwrap', 'facebookntaacc@gmail.com')
};

async function runProcess(ACCOUNTS) {

  try {
    // Check the balance of all accounts (Balance = ETH + WETH)
    // And choose the account with the highest balance to run process
    // The account with the highest balance will be the first account
    let highestBalanceAccount = ACCOUNTS[0];
    let highestBalance = 0;
    for (const account of ACCOUNTS) {
      const ether_balance = await handleError(web3.eth.getBalance(account.address));
      const wrap_balance = await handleError(SM_USE.methods.balanceOf(account.address).call());
      const balance = convertWeiToNumber(ether_balance + wrap_balance);
      if (balance > highestBalance) {
        highestBalance = balance;
        highestBalanceAccount = account;
      }
      console.log("Account:", shortAddress(account.address), "- Balance:",
        convertWeiToNumber(ether_balance), "- WETH:", convertWeiToNumber(wrap_balance));
    }
    const highestBalanceIndex = ACCOUNTS.indexOf(highestBalanceAccount);
    if (highestBalanceIndex > 0) {
      ACCOUNTS.splice(highestBalanceIndex, 1);
      ACCOUNTS.unshift(highestBalanceAccount);
    }

    // First, check the balance of the 1st account
    // If the balance is less than MIN_BALANCE, stop the process
    if (highestBalance < MIN_BALANCE) {
      console.error("Balance of first account is less than MIN_BALANCE. Stop the process!!!");
      process.exit(1); // Dừng toàn bộ chương trình ngay lập tức
    }

    const lengthOfAccounts = ACCOUNTS.length;
    const TOKEN_IDs = Object.keys(constants)
      .filter(key => key.startsWith('TOKEN_ID'))
      .map(key => constants[key]);
    console.log("List of token ID:", TOKEN_IDs);

    // 1. Listing nft on all accounts
    // ================================================================================================
    if (lengthOfAccounts > 1) {

      // Price of 1 nft is the balance of the first account 
      // minus the fee for wrap and vote in all accounts
      let priceInETH = Number(highestBalance);
      let reserveETH = 0.0008;

      for (let i = 0; i < ACCOUNTS.length; i++) {
        let i_tmp = (i + 1) % ACCOUNTS.length;

        const last3Char = ACCOUNTS[i].address.slice(-3).toUpperCase();
        if (last3Char !== '8F3' && last3Char !== '400' && last3Char !== 'C1D') {
          reserveETH = 0.0003;
        } else reserveETH = 0.0008;

        try {
          const newBalance = i !== 0 ? await handleError(web3.eth.getBalance(ACCOUNTS[i].address)) : 0n;
          priceInETH = priceInETH - reserveETH + convertWeiToNumber(newBalance);
          console.log("Price in ETH:", priceInETH, "ETH");
        } catch (error) {
          console.error("Error when get balance of account:", error.message);
          priceInETH = 0;
        }

        // Listing tất cả các tokenId 
        console.log(`\nStart listing NFT on account ${i_tmp + 1}: ${shortAddress(ACCOUNTS[i_tmp].address)}`);
        // khai bao mot mang de luu cac tokenId, sau do loại bo tokenId da duoc list
        const tokenIdsToList = [...TOKEN_IDs];
        for (let index = 0; index < tokenIdsToList.length; index++) {
          let index_tmp = (index + 1) % tokenIdsToList.length;

          try {
            await new Promise(resolve => setTimeout(resolve, WAIT_25S / 25));

            const item = {
              collectionAddress: COLLECTION_ADDRESS,
              tokenId: tokenIdsToList[index_tmp],
              price: web3.utils.toWei(priceInETH.toString(), 'ether'),
              currencyAddress: CURRENCY_ADDRESS,
              count: COUNT,
              platform: PLATFORM,
            }
            const response = await listNFT(
              ACCOUNTS[i_tmp].okx_key,
              ACCOUNTS[i_tmp].okx_api,
              ACCOUNTS[i_tmp].okx_pass,
              "taiko",
              ACCOUNTS[i_tmp].address,
              item,
            );
            if (!response || !response.data) {
              throw new Error("API không trả về dữ liệu hợp lệ!");
            }

            await new Promise(resolve => setTimeout(resolve, WAIT_25S / 25));

            const res = await signAndSubmitOrder(
              response,
              ACCOUNTS[i_tmp].okx_key,
              ACCOUNTS[i_tmp].okx_api,
              ACCOUNTS[i_tmp].okx_pass,
              ACCOUNTS[i_tmp].privateKey,
            );
            if (res.data.data?.successOrderIds[0] === undefined) {
              console.error("OrderID is null. Try to find another NFT...");
            } else {
              console.log(`Listed NFT with orderID [${res.data.data.successOrderIds[0]}] and the token ID [${tokenIdsToList[index_tmp]}]\n`);
              tokenIdsToList.splice(index, 1); // Xóa tokenId đã list khỏi danh sách
              break;
            }
          } catch (error) {
            console.error("Error when try to list NFT:", error.message);
          }
        }
      }
    }
    // ================================================================================================

    // 2. Start earning points from Wrap or Vote And buy NFT to transfer ETH
    // ================================================================================================
    for (let i = 0; i < ACCOUNTS.length; i++) {
      const currentAccount = ACCOUNTS[i];
      const nextAccount = ACCOUNTS[(i + 1) % ACCOUNTS.length]; // Tài khoản tiếp theo (xoay vòng nếu hết danh sách)

      // Show account
      const ether = convertWeiToNumber(await handleError(web3.eth.getBalance(currentAccount.address)));
      const wrap_ether = convertWeiToNumber(await handleError(SM_USE.methods.balanceOf(currentAccount.address).call()));
      console.log("\nCurrent account:", shortAddress(currentAccount.address), "- Balance:", ether, "- WETH:", wrap_ether);
      console.log(`\tAPI Key: ${currentAccount.okx_api}`);
      console.log(`\tSecret Key: ${currentAccount.okx_key}`);

      // ================== Start Wrap/Unwrap And Voting ==================
      const statusWrapVote = await processWallet(currentAccount);
      if (statusWrapVote === null) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, WAIT_25S / 5));

      // ================== Start Buy NFT ==================
      if (lengthOfAccounts > 1) {
        console.log("\nStart buying NFT...");
        let orderID = null;
        for (let i = 0; i < TOKEN_IDs.length; i++) {
          const resultQuery = await GetQueryListing(
            currentAccount.okx_key,
            currentAccount.okx_api,
            currentAccount.okx_pass,
            "taiko",
            TOKEN_IDs[i],
            COLLECTION_ADDRESS,
            nextAccount.address.toLowerCase(),
          );

          orderID = CheckQueryListing(
            resultQuery,
            TOKEN_IDs[i],
            COLLECTION_ADDRESS,
            nextAccount.address.toLowerCase(),
          );
          if (orderID === null) {
            console.log("OrderID is null. Try to find another NFT...");
          }
          else {
            console.log(`Found NFT with orderId [${orderID}] and the token ID [${TOKEN_IDs[i]}]\n`);
            break;
          }
          await new Promise(r => setTimeout(r, 2000));
        }

        if (orderID !== null) {
          const item = {
            orderId: orderID,
            takeCount: 1
          }
          const resultPostBuy = await PostBuyNFT(
            currentAccount.okx_key,
            currentAccount.okx_api,
            currentAccount.okx_pass,
            "taiko",
            currentAccount.address,
            item,
          );
          // Lấy dữ liệu từ response
          const rawTnxData = resultPostBuy.data?.data.steps[0].items[0];
          const contractAddress = rawTnxData.contractAddress;
          const inputData = rawTnxData.input;
          const value = rawTnxData.value; // in wei

          // Dữ liệu giao dịch lấy từ OKX API
          const transactionData = {
            to: contractAddress,
            data: inputData,
            value: value, // Giá trị cần gửi (wei)
          };

          // Thực hiện giao dịch mua NFT
          let attempt = 0, lastError = null;
          const maxRetries = 5;
          while (attempt < maxRetries) {
            try {
              console.log(`🔄 Attempt ${attempt + 1}/${maxRetries} to buy NFT...`);
              const receipt = await SignAndBuyNFT(
                transactionData,
                currentAccount,
              );
              if (receipt) {
                console.log("✅ Buy NFT successfully");
                await new Promise(resolve => setTimeout(resolve, WAIT_25S / 5));
                break;
              }

            } catch (error) {
              lastError = error.message;
              console.error(`❌ Buy NFT failed: ${lastError}`);
            }

            attempt++;
            if (attempt < maxRetries) {
              const delay = (Math.random() * 5000) + 5000; // Đợi 5-10s trước khi retry
              console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
      }
      // ================================================================================================
    }
    console.log("All wallets processed.");
  } catch (error) {
    if (error.message === 'Process terminated at 0h UTC') {
      console.log(error.message);
    } else {
      console.error("An unexpected error occurred in runProcess function:", error.message);
    }
  }
};

async function main() {
  // Kiểm tra các điều kiện ban đầu trước khi chạy tool
  if (PRIVATE_KEYS.length === 0) {
    console.error("No private keys provided. Please set the environment variables.");
    process.exit(1);
  }

  const ACCOUNTS = PRIVATE_KEYS.map((key, index) => {
    const account = web3.eth.accounts.privateKeyToAccount(key);
    return {
      ...account,
      okx_key: OKX_KEYs[index],
      okx_pass: OKX_PASSPHRASEs[index],
      okx_api: OKX_APIs[index]
    };
  });
  if (ACCOUNTS.length === 0) {
    console.error("No valid accounts found. Please check your private keys.");
    process.exit(1);
  }

  console.log(`\nWe found ${ACCOUNTS.length} account(s)`);
  for (let i = 0; i < ACCOUNTS.length; i++) {
    const account = ACCOUNTS[i];
    console.log(`Account ${i + 1}: ${account.address}`);
  }

  console.log("\no __________________ WRAP  _________________");
  console.log("o Run on", chain);
  console.log("o SM:", SM_USE._address);
  console.log("o RPC:", RPC_URL);
  console.log("o POINT WRAP:", MAX_POINT_WRAP);
  console.log("o POINT VOTE:", MAX_POINT_VOTE);

  const autoRun = async () => {
    console.log("\nQuá thời gian chờ. Tự động chạy tool...");
    rl.close();
    await runProcess(ACCOUNTS);

  };

  // Chờ xác nhận từ người dùng trước khi chạy tool (1 phút)
  const timer = setTimeout(autoRun, WAIT_25S);
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

// Đặt hẹn giờ để dừng tiến trình vào 0h UTC
setTimeout(() => {
  console.log("💀 Đến 0h UTC, tiến trình bị dừng!");
  process.exit(1); // Dừng toàn bộ chương trình ngay lập tức
}, getTimeUntilMidnightUTC());

function getTimeUntilMidnightUTC() {
  const now = new Date();
  const midnightUTC = new Date(now);
  midnightUTC.setUTCHours(0, 0, 0, 0); // Đặt về 0h UTC

  if (now >= midnightUTC) {
    midnightUTC.setUTCDate(midnightUTC.getUTCDate() + 1); // Chuyển sang ngày tiếp theo
  }

  return midnightUTC - now; // Thời gian còn lại (milliseconds)
}

/**
 * Change colors reference of text
 * @tutorial https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
 */