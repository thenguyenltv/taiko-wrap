
const {
  LOG_FILE
} = require('./constant');

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

/**
 * Function to log messages to the file
 * @param {*} message 
 */
function logMessage(message) {
  const logFilePath = path.join(__dirname, LOG_FILE);
  const timestamp = new Date().toLocaleString(); // Add a timestamp
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
    // Handle the error appropriately here
    // return null; 
    // or throw error if you want to propagate it
    throw new Error(error);
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

function shortAddress(address) {
  if (address.length < 8) {
    return address; // or handle the case where the address is too short
  }
  const firstFour = address.substring(0, 4);
  const lastFour = address.substring(address.length - 4);
  return firstFour + "..." + lastFour;
}

/**
 * Helper function for timeout
 */
function timeoutPromise(ms) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Transaction timeout: receipt not received within 5 minutes")), ms)
  );
}

function logElapsedTime(start) {
  let end = new Date().getTime();
  const time = Math.round((end - start) / 1000);
  const hours = Math.floor(time / 3600);
  const minutes = Math.floor((time % 3600) / 60);
  const seconds = Math.round(time % 60 * 100) / 100;

  return [hours, minutes, seconds];
}

/**
 * Send email to the user
 */
function sendEmail(body, subjectMail, mailTo) {
  var transporter = nodemailer.createTransport({
    service: 'yahoo',
    auth: {
      user: 'ketnoitvs43@yahoo.com',
      pass: 'zapwoczxwcoamebc'
    }
  });
  //zapwoczxwcoamebc

  var mailOptions = {
    from: 'ketnoitvs43@yahoo.com',
    to: mailTo,
    subject: subjectMail,
    text: body
  };

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

module.exports = {
  handleError,
  getPrice,
  convertWeiToNumber,
  timeoutPromise,
  shortAddress,
  logMessage,
  logElapsedTime,
  sendEmail
};

// sendEmail('That was easy!', 'Sending Email using Node.js', 'facebookntaacc@gmail.com'); // Call the function to send email~