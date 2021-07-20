//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface Staking {
    function stake(uint256 _amount) external;

    function unStake() external;

    function withdraw() external;

    function claimRewards() external;

    function stakeOf(address _address) external view returns (uint256);

    function totalStakes() external view returns (uint256);

    function checkRewards() external view returns (uint256);

    function totalRewards() external view returns (uint256);

    function updateAPY(uint256 _apy) external;

    function updateUnBoundingPeriod(uint256 _unboundingPeriod) external;
}

contract StartWithStaking is Ownable, Staking {
    using SafeERC20 for IERC20;

    struct Staker {
        uint256 balance;
        uint256 rewards;
        uint256 stakeTime;
        uint256 unstakeTime;
        bool stakerExisted;
    }

    address[] internal stakers;
    mapping(address => Staker) stakersInfo;
    IERC20 token;
    uint256 apy;
    uint256 unboundingPeriod;

    // Unbounding period
    // stake
    // unstake
    // withdraw
    // claimRewards

    // rewardsFor()
    // stakeOf() / balanceOf()
    //

    //resources excel
    //sushiswap github

    constructor(
        IERC20 _stakeToken,
        uint256 _apy,
        uint256 _unboundingPeriod
    ) {
        token = _stakeToken;
        apy = _apy;
        unboundingPeriod = _unboundingPeriod;
    }

    //    tokens 100 , apy 100%, time 6 months -> balance -> 100, rewards -> 0
    // Stake 50 more -> balance 150, rewards -> 50, rewardsOf() -> 50 + (currentTime - stakeTime) * balance (150) *  bla bla

    // Usecase 1 -> APY 100% -> User 1 comes and stakes 100 tokens -> After a year total will be 200 tokens
    // Now after 6 months of initial stake user 1 again contributes 100 tokens
    // Now at the end of 1st year user 1 should have 350 tokens
    // Usercase 2 -> User unstake and stakes again in unbounding period
    // 3 -> User withdraws his rewards only
    // 4 -> Owner updates the APY
    // 5 -> Owner updates the unbounding period

    function stake(uint256 _amount) external override {
        _updateRewards(msg.sender);
        if (!stakersInfo[msg.sender].stakerExisted) {
            addStaker(msg.sender, _amount);
        } else {
            _updateStakeAndUnstakeTime();
        }
        stakersInfo[msg.sender].balance += _amount;
        token.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function unStake() external override isStaker {
        Staker storage _staker = stakersInfo[msg.sender];
        _staker.unstakeTime = block.timestamp;
        _updateRewards(msg.sender);
    }

    function withdraw() external override isStaker {
        Staker storage _staker = stakersInfo[msg.sender];
        require(
            _staker.unstakeTime + unboundingPeriod <= block.timestamp,
            "unbounding period is not over yet"
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

    function stakeOf(address _address)
        external
        view
        override
        returns (uint256)
    {
        return stakersInfo[_address].balance;
    }

    function totalStakes() external view override returns (uint256) {
        uint256 _totalStakes;
        for (uint256 i = 0; i < stakers.length; i++) {
            _totalStakes += stakersInfo[stakers[i]].balance;
        }
        return _totalStakes;
    }

    function checkRewards() external view override returns (uint256) {
        return calculateReward();
    }

    function totalRewards() external view override returns (uint256) {
        uint256 _totalRewards;
        for (uint256 i = 0; i < stakers.length; i++) {
            _totalRewards += stakersInfo[stakers[i]].rewards;
        }
        return _totalRewards;
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

    function addStaker(address _address, uint256 _amount) private {
        Staker memory _staker = Staker(_amount, 0, block.timestamp, 0, true);
        stakersInfo[_address] = _staker;
        stakers.push(_address);
    }

    function _updateRewards(address _address) private {
        Staker storage _staker = stakersInfo[_address];
        _staker.rewards = calculateReward();
    }

    function _updateStakeAndUnstakeTime() private {
        stakersInfo[msg.sender].stakeTime = block.timestamp;
        if (stakersInfo[msg.sender].unstakeTime != 0) {
            stakersInfo[msg.sender].unstakeTime = 0;
        }
    }

    function calculateReward() private view returns (uint256) {
        Staker memory _staker = stakersInfo[msg.sender];
        uint256 stakeDuration;

        if (_staker.unstakeTime != 0 && _staker.rewards == 0) {
            // rewards already claimed.
            return 0;
        } else if (_staker.unstakeTime == 0) {
            // unstake request not placed yet.
            stakeDuration = block.timestamp - _staker.stakeTime;
        } else {
            // unstake request already placed.
            stakeDuration = _staker.unstakeTime - _staker.stakeTime;
        }
        //TODO Need to convert APY to percentage here
        uint256 _rewards = stakersInfo[msg.sender].balance *
            apy *
            stakeDuration;
        return stakersInfo[msg.sender].rewards + _rewards;
    }

    modifier isStaker() {
        require(stakersInfo[msg.sender].balance > 0, "Not a staker");
        _;
    }
}
