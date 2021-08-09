//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IStaking {
    
    function stake(uint256 _amount) external;

    function unstake() external;

    function withdraw() external;

    function claimRewards() external;

    function stakeOf() external view returns (uint256);

    function totalStakes() external view returns (uint256);

    function rewardsOf(address _address) external view returns (uint256);

    function totalRewards() external view returns (uint256);

    function updateAPY(uint256 _apy) external;

    function updateClaimDelay(uint256 _claimDelay) external;

    function updateUnbondingPeriod(uint256 _unbondingPeriod) external;
}
