@echo off

set KEY=YOUR_KEY
set RPC_URL=YOUR_RPC
node wrap.js [TARGET_POINT_VOLUME] [TARGET_POINT_TNX]

pause

:: ___Example___
:: @echo off
:: set KEY=0x1234567890abcdef1234567890abcdef12345678
:: set RPC_URL=https://rpc.mainnet.taiko.xyz
:: node wrap.js 73580 73580
:: pause