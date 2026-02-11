// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/RedPacket.sol";

contract DeployRedPacket is Script {
    function run() external {
        address usdc = vm.envAddress("USDC_ADDRESS");
        address signerAddress = vm.envAddress("SIGNER_ADDRESS");

        vm.startBroadcast();

        RedPacket redPacket = new RedPacket(usdc, signerAddress);

        console.log("RedPacket deployed at:", address(redPacket));
        console.log("USDC address:", usdc);
        console.log("Signer address:", signerAddress);

        vm.stopBroadcast();
    }
}
