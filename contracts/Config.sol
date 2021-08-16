//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Config {
    struct Staker {
        uint256 balance;
        uint256 rewards;
        uint256 stakeTime;
        uint256 unstakeTime;
        uint256 rewardsClaimedTime;
    }

    address[] public stakers;
    mapping(address => Staker) stakersInfo;

    IERC20 internal token;
    uint256 public apy; // In Percent
    uint256 public unbondingPeriod;
    uint256 public claimDelay;
    bool public pauseStatus;
    bool public stopStatus;
    uint public immediateUnstakeFine; // In percent
    uint256 internal constant ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60;
    uint256 internal constant PERCENTAGE_MULTIPLIER = 100;
}
