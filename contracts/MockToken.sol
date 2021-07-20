//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {

uint256 private SUPPLY = 100 * 100 * 100 * 10**18;

constructor() 
ERC20("MockStakingToken", "MST") {
        _mint(msg.sender, SUPPLY);
}

}
