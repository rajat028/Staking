//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Staking.sol";

contract StartWithStaking is Ownable, Staking {
    using SafeERC20 for IERC20;

    struct Staker {
        uint256 balance;
        uint256 rewards;
        uint256 stakeTime;
        uint256 unstakeTime;
    }

    address[] internal stakers;
    mapping(address => Staker) stakersInfo;
    IERC20 private token;
    uint256 private apy;
    uint256 private unboundingPeriod;
    uint256 private ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60;

    constructor(
        IERC20 _stakeToken,
        uint256 _apy,
        uint256 _unboundingPeriod
    ) {
        token = _stakeToken;
        apy = _apy;
        unboundingPeriod = _unboundingPeriod;
    }

    function stake(uint256 _amount) external override {
        _updateRewards(msg.sender);
        if (stakersInfo[msg.sender].stakeTime == 0) {
            addStaker(msg.sender);
        } else {
            _updateStakeAndUnstakeTime();
        }
        stakersInfo[msg.sender].balance += _amount;
        token.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function unstake() external override isStaker {
        Staker storage _staker = stakersInfo[msg.sender];
        require(_staker.unstakeTime == 0, "Unstake request already placed");
        _staker.unstakeTime = block.timestamp;
        _updateRewards(msg.sender);
    }

    function withdraw() external override isStaker {
        Staker storage _staker = stakersInfo[msg.sender];
        require(_staker.unstakeTime != 0, "Unstake not requested");
        require(
            _staker.unstakeTime + unboundingPeriod <= block.timestamp,
            "Unbounding period is not over yet"
        );
        token.safeTransfer(msg.sender, _staker.balance + _staker.rewards);
        _staker.balance = 0;
        _staker.rewards = 0;
    }

    function claimRewards() external override isStaker {
        _updateRewards(msg.sender);
        Staker storage _staker = stakersInfo[msg.sender];
        token.safeTransfer(msg.sender, _staker.rewards);
        _staker.rewards = 0;
    }

    function updateAPY(uint256 _apy) external override onlyOwner {
        for (uint256 i = 0; i < stakers.length; i++) {
            _updateRewards(stakers[i]);
        }
        apy = _apy;
    }

    function updateUnBoundingPeriod(uint256 _unboundingPeriod)
        external
        override
        onlyOwner
    {
        unboundingPeriod = _unboundingPeriod;
    }

    function addStaker(address _address) private {
        Staker memory _staker = Staker(0, 0, block.timestamp, 0);
        stakersInfo[_address] = _staker;
        stakers.push(_address);
    }

    function _updateRewards(address _address) private {
        Staker storage _staker = stakersInfo[_address];
        _staker.rewards = calculateReward(_address);
    }

    function _updateStakeAndUnstakeTime() private {
        stakersInfo[msg.sender].stakeTime = block.timestamp;
        if (stakersInfo[msg.sender].unstakeTime != 0) {
            // reset unstake time if user stakes again
            stakersInfo[msg.sender].unstakeTime = 0;
        }
    }

    function calculateReward(address _address) private view returns (uint256) {
        Staker memory _staker = stakersInfo[_address];
        uint256 stakeDuration;

        if (_staker.stakeTime == 0 && _staker.unstakeTime == 0) {
            // before stake
            return 0;
        } else if (_staker.unstakeTime == 0) {
            // unstake request not placed yet.
            stakeDuration = block.timestamp - _staker.stakeTime;
        } else {
            // unstake request already placed.
            stakeDuration = _staker.unstakeTime - _staker.stakeTime;
        }
        uint256 _rewards = (stakersInfo[_address].balance *
            apy *
            stakeDuration) / (ONE_YEAR_IN_SECONDS * 100);
        return stakersInfo[_address].rewards + _rewards;
    }

    function stakeOf() external view override returns (uint256) {
        return stakersInfo[msg.sender].balance;
    }

    function totalStakes() external view override returns (uint256) {
        uint256 _totalStakes;
        for (uint256 i = 0; i < stakers.length; i++) {
            _totalStakes += stakersInfo[stakers[i]].balance;
        }
        return _totalStakes;
    }

    function rewardsOf(address _address) external view override returns (uint256) {
        Staker memory _staker = stakersInfo[_address];
        if (_staker.unstakeTime == 0) {
            return calculateReward(_address);
        } else {
            return _staker.rewards;
        }
    }

    function totalRewards() external view override returns (uint256) {
        uint256 _totalRewards;
        for (uint256 i = 0; i < stakers.length; i++) {
            _totalRewards += stakersInfo[stakers[i]].rewards;
        }
        return _totalRewards;
    }

    function getAPY() external view returns (uint256) {
        return apy;
    }

    function getUnboundingPeriod() external view returns (uint256) {
        return unboundingPeriod;
    }

    function getStaker() external view returns (Staker memory) {
        return stakersInfo[msg.sender];
    }

    function getAllStakers() external view returns (address[] memory) {
        return stakers;
    }

    function getContractBalance() external view onlyOwner returns (uint256) {}

    modifier isStaker() {
        require(stakersInfo[msg.sender].balance > 0, "Not a staker");
        _;
    }
}
