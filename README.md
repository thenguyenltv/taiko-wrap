# Taiko Trailblazer Campaign: Automated Wrapping and NFT Purchase System

This project is a **technical proof-of-concept** developed to explore blockchain automation and discreet value transfer mechanisms on the Taiko Network as part of the **Taiko Trailblazer Campaign**. It automates the wrapping/unwrapping of ETH to WETH and purchases NFTs on the OKX NFT Marketplace to transfer value between wallets. The system achieved **73,580 points** in the campaign, demonstrating robust automation and blockchain interaction capabilities.

> **Note**: This project is strictly experimental, built for technical exploration and learning purposes. It is not intended for commercial or illicit use.

## Features

### 1. Automated ETH/WETH Wrapping
- **Functionality**: Automatically wraps ETH to WETH and unwraps WETH to ETH by interacting with WETH smart contracts on the Taiko Network.
- **Implementation**: The bot continuously monitors and executes wrap/unwrap transactions until a predefined daily volume target is met, ensuring consistent campaign point accumulation.
- **Automation**: Runs autonomously via a single `.bat` script on Windows, requiring no manual intervention.

### 2. NFT Purchase for Value Transfer
- **Functionality**: Purchases NFTs through the OKX NFT Marketplace API to facilitate discreet value transfers between wallets.
- **Purpose**: Designed as a technical experiment to explore NFT-based value transfer mechanisms, leveraging the Taiko Network’s efficiency.
- **Integration**: Securely interacts with the OKX API to execute NFT purchases and transfer ownership to a designated wallet.

## Technical Challenges Overcome
This project addressed several complex technical challenges, showcasing advanced blockchain development skills:

- **Transaction Reliability**: Built robust error-handling mechanisms to manage failed transactions caused by network congestion or gas price fluctuations.
- **Gas Optimization**: Optimized Web3.js interactions to minimize gas costs during high-frequency wrapping operations, improving efficiency on the Taiko Network.
- **Automation Stability**: Ensured the `.bat` script ran reliably without crashes, handling edge cases like network delays or API rate limits.

## Tools and Technologies
- **Node.js**: Core runtime for building the automation script.
- **Web3.js**: Library for interacting with Taiko Network’s WETH smart contracts.
- **OKX NFT Marketplace API**: Used for programmatic NFT purchases.
- **Windows Batch Script**: Enabled one-click automation for the entire workflow.

## Achievements
- Successfully accumulated **73,580 points** in the Taiko Trailblazer Campaign through consistent and optimized transaction automation.
- Demonstrated proficiency in blockchain automation, smart contract interaction, and secure API integration.

## Purpose and Context
This project was developed as part of the Taiko Trailblazer Campaign to test the limits of blockchain automation and explore innovative value transfer methods. By combining ETH/WETH wrapping with NFT purchases, it showcases the potential of the Taiko Network for efficient, low-cost transactions. The use of NFTs for value transfer was implemented to study discreet transaction mechanisms in a controlled, experimental environment (e.g., testnet or campaign-specific setup).

## How to Run
Follow these steps to set up and run the project on a Windows machine:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/thenguyenltv/taiko-wrap.git
   cd taiko-wrap

2. **Install Dependencies**: Install the required Node.js libraries using npm:
    ```bash
    npm install

3. **Configure the Script**:
   - Open the `wrap.bat` file in a text editor.
   - Update the following variables with your credentials:
     - `KEY`: Your private key for the Taiko Network wallet (ensure this is kept secure and never committed to version control).
     - `RPC_URL`: The Taiko Network RPC endpoint URL (e.g., a testnet or mainnet RPC provided by Taiko or a service like Infura).
   - Save the changes.

3. **Run the Script**:
   - Double-click the `wrap.bat` file or run it from the command prompt:
     ```bash
     wrap.bat
    - The script will display initial configuration details (e.g., wallet address, RPC connection status, and target volume).
    - Review the output carefully to ensure all settings are correct.
    - Confirm to proceed with the automation process when prompted.
  
4. **Monitor Output**:
   - The script will log transaction details, such as Network used, wrap/unwrap confirmations and NFT purchases, to the console.
   - Check for any errors related to network issues, insufficient funds, or API rate limits.

> **Warning**: Use a testnet environment or a wallet with minimal funds for testing to avoid financial loss. Ensure your `KEY` is stored securely and not exposed.

## Contact
For questions or feedback, feel free to reach out via [GitHub Issues](https://github.com/thenguyenltv/taiko-wrap/issues) or email at [thenguyenltv@gmail.com].

---

*Built by [thenguyenltv], a blockchain enthusiast passionate about DeFi, smart contract development, and automation.*
