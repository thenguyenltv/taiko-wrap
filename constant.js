module.exports = {
  CEIL_GAS: 60_000_002n, // 1 gwei = 1.000.000.000 wei
  MIN_GAS_PRICE: 6_000_000n, 
  MIN_BALANCE: 0.0004, // ETH units, the minimum balance to keep in the account when sending eth to another account
  LOG_FILE: "wrap_log.log",
  // https://rpc.mainnet.taiko.xyz
  // https://rpc.taiko.xyz
  // https://mainnet.taiko-rpc.com/
  // https://rpc.ankr.com/taiko
  // https://rpc.zerion.io/v1/taiko
  // https://rpc.ankr.com/taiko/a4d0b9019e455492c401aa9499bb36139980e8772bb41b304c4cd2afd4443a42
  // https://rpc.ankr.com/taiko/92f19728a43f08d9aa5600b526678df10e753c8b600a68c5a644623eb6c7acb6

  // https://rpc.hekla.taiko.xyz
  // https://taiko-hekla.gateway.tenderly.co/7H3yO1Br2LR3cPgBu24F3c

  // TOKEN_ID1: 472691,
  // TOKEN_ID3: 53899,
  TOKEN_ID2: 475474,
  TOKEN_ID4: 475842,
  TOKEN_ID5: 475473,
  TOKEN_ID6: 454134,
  // TOKEN_ID7: 459488,
  // TOKEN_ID8: 249344,
  TOKEN_ID9: 46028,
  TOKEN_ID10: 455406,
  TOKEN_ID11: 48869,
  TOKEN_ID12: 241296,
  TOKEN_ID13: 452330,
  
  COLLECTION_ADDRESS: "0xa20a8856e00f5ad024a55a663f06dcc419ffc4d5",
  COUNT: 1,
  CURRENCY_ADDRESS: "0x0000000000000000000000000000000000000000",
  PLATFORM: "okx",
  
  SM_ADDRESS: "0xA51894664A773981C6C112C43ce576f315d5b1B6",
  TEST_SM_WETH: '0xae2C46ddb314B9Ba743C6dEE4878F151881333D9',

  Mainnet: 167000,
  Testnet: 167009,

  CONTRACT_VOTE: '0x4D1E2145082d0AB0fDa4a973dC4887C7295e21aB',
  ABI_VOTE: [
    { stateMutability: 'payable', type: 'fallback' },
    {
      inputs: [],
      name: 'vote',
      outputs: [],
      stateMutability: 'payable',
      type: 'function'
    }
  ],

  SM_ABI: [
    {
      "constant": true,
      "inputs": [],
      "name": "name",
      "outputs": [
        {
          "name": "",
          "type": "string"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "guy",
          "type": "address"
        },
        {
          "name": "wad",
          "type": "uint256"
        }
      ],
      "name": "approve",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "totalSupply",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "src",
          "type": "address"
        },
        {
          "name": "dst",
          "type": "address"
        },
        {
          "name": "wad",
          "type": "uint256"
        }
      ],
      "name": "transferFrom",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "wad",
          "type": "uint256"
        }
      ],
      "name": "withdraw",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "decimals",
      "outputs": [
        {
          "name": "",
          "type": "uint8"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "",
          "type": "address"
        }
      ],
      "name": "balanceOf",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "symbol",
      "outputs": [
        {
          "name": "",
          "type": "string"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "dst",
          "type": "address"
        },
        {
          "name": "wad",
          "type": "uint256"
        }
      ],
      "name": "transfer",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [],
      "name": "deposit",
      "outputs": [],
      "payable": true,
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "",
          "type": "address"
        },
        {
          "name": "",
          "type": "address"
        }
      ],
      "name": "allowance",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "payable": true,
      "stateMutability": "payable",
      "type": "fallback"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "src",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "guy",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "wad",
          "type": "uint256"
        }
      ],
      "name": "Approval",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "src",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "dst",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "wad",
          "type": "uint256"
        }
      ],
      "name": "Transfer",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "dst",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "wad",
          "type": "uint256"
        }
      ],
      "name": "Deposit",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "src",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "wad",
          "type": "uint256"
        }
      ],
      "name": "Withdrawal",
      "type": "event"
    }
  ],

  TEST_ABI_WETH: [
    {
      "constant": true,
      "inputs": [],
      "name": "name",
      "outputs": [
        {
          "name": "",
          "type": "string"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "guy",
          "type": "address"
        },
        {
          "name": "wad",
          "type": "uint256"
        }
      ],
      "name": "approve",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "totalSupply",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "src",
          "type": "address"
        },
        {
          "name": "dst",
          "type": "address"
        },
        {
          "name": "wad",
          "type": "uint256"
        }
      ],
      "name": "transferFrom",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "wad",
          "type": "uint256"
        }
      ],
      "name": "withdraw",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "decimals",
      "outputs": [
        {
          "name": "",
          "type": "uint8"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "",
          "type": "address"
        }
      ],
      "name": "balanceOf",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "symbol",
      "outputs": [
        {
          "name": "",
          "type": "string"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "dst",
          "type": "address"
        },
        {
          "name": "wad",
          "type": "uint256"
        }
      ],
      "name": "transfer",
      "outputs": [
        {
          "name": "",
          "type": "bool"
        }
      ],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [],
      "name": "deposit",
      "outputs": [],
      "payable": true,
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [
        {
          "name": "",
          "type": "address"
        },
        {
          "name": "",
          "type": "address"
        }
      ],
      "name": "allowance",
      "outputs": [
        {
          "name": "",
          "type": "uint256"
        }
      ],
      "payable": false,
      "stateMutability": "view",
      "type": "function"
    },
    {
      "payable": true,
      "stateMutability": "payable",
      "type": "fallback"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "src",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "guy",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "wad",
          "type": "uint256"
        }
      ],
      "name": "Approval",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "src",
          "type": "address"
        },
        {
          "indexed": true,
          "name": "dst",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "wad",
          "type": "uint256"
        }
      ],
      "name": "Transfer",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "dst",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "wad",
          "type": "uint256"
        }
      ],
      "name": "Deposit",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "name": "src",
          "type": "address"
        },
        {
          "indexed": false,
          "name": "wad",
          "type": "uint256"
        }
      ],
      "name": "Withdrawal",
      "type": "event"
    }
  ]
};