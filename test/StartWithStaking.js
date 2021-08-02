const { expect, assert } = require('chai')
const { utils } = require('ethers')
const { time } = require('@openzeppelin/test-helpers')

function tokenOf(value) {
    return utils.parseUnits(value.toString(), 18)
}

describe("StartWithStaking Contract", () => {
    let StartWithStaking, stakingContract, owner, staker1, staker2, staker3, MockToken
    let staker1Contract
    let token1Contract
    let tokenContract
    let apy = 7
    let unboundingPeriod = 10
    const ONE_YEAR_IN_SECONDS = 365 * 24 * 60 * 60
    const ONE_MONTH_IN_SECONDS = 30 * 24 * 60 * 60
    const ONE_HOUR_IN_SECONDS = 60 * 60

    beforeEach(async () => {
        [owner, staker1, staker2, staker3, _] = await ethers.getSigners()

        MockToken = await ethers.getContractFactory('MockToken')
        tokenContract = await MockToken.deploy()
        await tokenContract.deployed()

        StartWithStaking = await ethers.getContractFactory('StartWithStaking')
        stakingContract = await StartWithStaking.deploy(tokenContract.address, apy, unboundingPeriod)
        await stakingContract.deployed()

        staker1Contract = stakingContract.connect(staker1)
        token1Contract = tokenContract.connect(staker1)
    })

    describe("Owner operations", () => {

        it("should assign the corret values", async () => {
            expect(await stakingContract.getAPY()).equal(apy)
            expect(await stakingContract.getUnboundingPeriod()).equal(unboundingPeriod)
        })

        it("should through error if non-owner tries to update APY", async () => {
            // Given
            const APY = 10

            await expect(stakingContract.connect(staker1).updateAPY(APY))
                .to.be.
                revertedWith("Ownable: caller is not the owner")
        })

        it("should be able to update APY by owner only", async () => {
            // Given
            const APY = 10;
            const stakingAmount = tokenOf(100)
            await tokenContract.transfer(staker1.address, stakingAmount)
            await token1Contract.approve(stakingContract.address, stakingAmount)
            await staker1Contract.stake(stakingAmount)

            const stakerBeforeApyUpdated = await staker1Contract.getStaker()
            const rewardsBeforeApyUpdated = stakerBeforeApyUpdated.rewards

            await ethers.provider.send("evm_increaseTime", [ONE_MONTH_IN_SECONDS])
            await ethers.provider.send("evm_mine", [])

            // When
            await stakingContract.updateAPY(APY)

            // Then
            expect(await stakingContract.getAPY()).equal(APY)

            const stakerAfterApyUpdated = await staker1Contract.getStaker()
            const rewardsAfterApyUpdated = stakerAfterApyUpdated.rewards
            assert.notEqual(rewardsBeforeApyUpdated.toString(), rewardsAfterApyUpdated.toString())

            await ethers.provider.send("evm_increaseTime", [-ONE_MONTH_IN_SECONDS])
        })

        it("should through error if non-owner tries to update unboundingPeriod", async () => {
            // Given
            await expect(stakingContract.connect(staker1).updateUnBoundingPeriod(unboundingPeriod))
                .to.be.
                revertedWith("Ownable: caller is not the owner")
        })

        it("should be able to update unboundingPeriod by owner only", async () => {
            // Given
            unboundingPeriod = 15;

            // When
            await expect(stakingContract.updateUnBoundingPeriod(unboundingPeriod))

            // Then
            expect(await stakingContract.getUnboundingPeriod()).equal(unboundingPeriod)
        })
    })

    describe("Staking Contract", () => {

        it("should be able to stake tokens and add as a staker", async () => {
            // Given 
            const stakingAmount = tokenOf(100)
            await tokenContract.transfer(staker1.address, stakingAmount)
            await token1Contract.approve(stakingContract.address, stakingAmount)
            const initialBalance = await tokenContract.balanceOf(stakingContract.address)

            // When
            await staker1Contract.stake(stakingAmount)

            // Then
            const finalBalance = await tokenContract.balanceOf(stakingContract.address)

            const stakers = await stakingContract.getAllStakers()
            const stakersCount = stakers.length
            expect(stakersCount).equal(1)

            const currentTime = Math.round(Date.now() / 1000)
            let staker = await staker1Contract.getStaker()
            expect(staker.balance.toString()).equal(stakingAmount.toString())
            expect(staker.rewards).equal(0)
            expect(staker.unstakeTime).equal(0)
            expect(staker.stakeTime.toNumber()).greaterThan(currentTime)

            let balance = finalBalance - initialBalance
            expect(balance.toString()).equal(stakingAmount.toString())
        })

        it("should not be able to unstake when not a staker", async () => {
            await expect(stakingContract.connect(staker2).unstake())
                .to.be.
                revertedWith("Not a staker")
        })

        it("should be able to request for unstake ", async () => {
            // Given 
            const stakingAmount = tokenOf(100)
            await tokenContract.transfer(staker1.address, stakingAmount)
            await token1Contract.approve(stakingContract.address, stakingAmount)
            staker1Contract.stake(stakingAmount)

            // When
            await staker1Contract.unstake()
            let stakerDetails = await staker1Contract.getStaker()
            assert.notEqual(stakerDetails.unstakeTime, 0)
        })

        it("should not be able to unstake when unstake request already placed", async () => {
            // Given 
            const stakingAmount = tokenOf(100)
            await tokenContract.transfer(staker1.address, stakingAmount)
            await token1Contract.approve(stakingContract.address, stakingAmount)
            await staker1Contract.stake(stakingAmount)

            // When
            await staker1Contract.unstake()

            await expect(staker1Contract.unstake())
                .to.be.
                revertedWith("Unstake request already placed")
        })

        it("should not be able to claim rewards if not staker", async () => {
            await expect(stakingContract.connect(staker2).claimRewards())
                .to.be.
                revertedWith("Not a staker")
        })


        it("should be able to claim rewards when unstake not requested", async () => {
            // Given 
            const stakingAmount = tokenOf(100)
            await tokenContract.transfer(staker1.address, stakingAmount)
            await token1Contract.approve(stakingContract.address, stakingAmount)
            await staker1Contract.stake(stakingAmount)

            await ethers.provider.send("evm_increaseTime", [ONE_MONTH_IN_SECONDS])
            await ethers.provider.send("evm_mine", [])

            // When
            const rewards = await stakingContract.rewardsOf(staker1.address)
            await staker1Contract.claimRewards()

            // Then
            const formattedRewards = rewards.toString().substring(0, 3)
            const finalBalance = await tokenContract.balanceOf(staker1.address)
            expect(formattedRewards).equal(finalBalance.toString().substring(0, 3))

            const staker = await staker1Contract.getStaker()
            expect(staker.rewards).equal(0)

            await ethers.provider.send("evm_increaseTime", [-ONE_MONTH_IN_SECONDS])
        })

        it("should not be able to withdraw if not staker", async () => {
            await expect(stakingContract.connect(staker2).withdraw())
                .to.be.
                revertedWith("Not a staker")
        })

        it("should not be able to withdraw if unstake not requested", async () => {
            const stakingAmount = tokenOf(100)
            await tokenContract.transfer(staker1.address, stakingAmount)
            await token1Contract.approve(stakingContract.address, stakingAmount)
            await staker1Contract.stake(stakingAmount)

            await expect(staker1Contract.withdraw())
                .to.be.
                revertedWith("Unstake not requested")
        })

        it("should not be able to withdraw if unbounding period is not over", async () => {
            // Given 
            const stakingAmount = tokenOf(100)
            const supplyAmount = tokenOf(1000)
            await tokenContract.transfer(staker1.address, stakingAmount)
            await token1Contract.approve(stakingContract.address, stakingAmount)
            await tokenContract.transfer(stakingContract.address, supplyAmount)
            await staker1Contract.stake(stakingAmount)

            await ethers.provider.send("evm_increaseTime", [ONE_HOUR_IN_SECONDS])
            await ethers.provider.send("evm_mine", [])

            await staker1Contract.unstake()

            await ethers.provider.send("evm_increaseTime", [ONE_HOUR_IN_SECONDS])
            await ethers.provider.send("evm_mine", [])

            let initialBalance = await tokenContract.balanceOf(staker1.address);
            let stakesBeforeWithdraw = await staker1Contract.stakeOf();
            let rewardsBeforeWithdraw = await stakingContract.rewardsOf(staker1.address)

            // When
            await staker1Contract.withdraw()

            // Then
            let balanceAfterWithdraw = await tokenContract.balanceOf(staker1.address)
            const result = initialBalance.add(stakesBeforeWithdraw.add(rewardsBeforeWithdraw))
            expect(result.toString()).equal(balanceAfterWithdraw.toString())

            const stakesAfterWithdraw = await staker1Contract.stakeOf()
            const rewardsAfterWithdraw = await stakingContract.rewardsOf(staker1.address)
            expect(stakesAfterWithdraw.toString()).equal("0")
            expect(rewardsAfterWithdraw.toString()).equal("0")

            await ethers.provider.send("evm_increaseTime", [-ONE_HOUR_IN_SECONDS])
            await ethers.provider.send("evm_increaseTime", [-ONE_HOUR_IN_SECONDS])
        })

        it("should be able to stake again", async () => {
            // Given
            const initialStakedTokenAmount = await tokenContract.balanceOf(stakingContract.address)

            const firstStakingAmount = tokenOf(100)
            await tokenContract.transfer(staker1.address, firstStakingAmount)
            await token1Contract.approve(stakingContract.address, firstStakingAmount)
            await staker1Contract.stake(firstStakingAmount)

            await ethers.provider.send("evm_increaseTime", [ONE_HOUR_IN_SECONDS])
            await ethers.provider.send("evm_mine", [])

            const stakerBeforeSecondStake = await staker1Contract.getStaker()
            const rewardsBeforeSecondStake = stakerBeforeSecondStake.rewards

            const stakersBeforeSecondStake = await stakingContract.getAllStakers()

            // When
            const secondStakingAmount = tokenOf(50)
            await tokenContract.transfer(staker1.address, secondStakingAmount)
            await token1Contract.approve(stakingContract.address, secondStakingAmount)
            await staker1Contract.stake(secondStakingAmount)

            // Then

            // Rewards updated
            const stakerAfterSecondStake = await staker1Contract.getStaker()
            const rewardsAfterSecondStake = stakerAfterSecondStake.rewards
            assert.notEqual(rewardsBeforeSecondStake, rewardsAfterSecondStake)

            // Stakers size remain same
            const stakersAfterSecondStake = await stakingContract.getAllStakers()
            expect(stakersAfterSecondStake.length).equal(stakersBeforeSecondStake.length)

            // Stake time updated
            expect(stakerAfterSecondStake.stakeTime.toNumber()).greaterThan(stakerBeforeSecondStake.stakeTime.toNumber())

            // Staker balance updated
            const stakeAmount = await staker1Contract.stakeOf()
            const totalStakeAmount = firstStakingAmount.add(secondStakingAmount).toString()
            expect(stakeAmount.toString()).equal(totalStakeAmount)

            // Tokens transfered
            const finalStakedTokenAmount = await tokenContract.balanceOf(stakingContract.address)
            expect(finalStakedTokenAmount.sub(initialStakedTokenAmount).toString()).equal(totalStakeAmount)

            await ethers.provider.send("evm_increaseTime", [-ONE_HOUR_IN_SECONDS])
            await ethers.provider.send("evm_mine", [])
        })

        it("should be able to stake again after unstake requested", async () => {
            // Given
            const initialStakedTokenAmount = await tokenContract.balanceOf(stakingContract.address)

            const firstStakingAmount = tokenOf(100)
            await tokenContract.transfer(staker1.address, firstStakingAmount)
            await token1Contract.approve(stakingContract.address, firstStakingAmount)
            await staker1Contract.stake(firstStakingAmount)

            await ethers.provider.send("evm_increaseTime", [ONE_HOUR_IN_SECONDS])
            await ethers.provider.send("evm_mine", [])

            await staker1Contract.unstake()

            const stakerBeforeSecondStake = await staker1Contract.getStaker()
            const rewardsBeforeSecondStake = stakerBeforeSecondStake.rewards

            await ethers.provider.send("evm_increaseTime", [ONE_HOUR_IN_SECONDS])
            await ethers.provider.send("evm_mine", [])

            const stakersBeforeSecondStake = await stakingContract.getAllStakers()

            // When
            const secondStakingAmount = tokenOf(50)
            await tokenContract.transfer(staker1.address, secondStakingAmount)
            await token1Contract.approve(stakingContract.address, secondStakingAmount)
            await staker1Contract.stake(secondStakingAmount)

            // Then

            // Rewards updated
            const stakerAfterSecondStake = await staker1Contract.getStaker()
            const rewardsAfterSecondStake = stakerAfterSecondStake.rewards
            assert.notEqual(rewardsBeforeSecondStake, rewardsAfterSecondStake)

            // Stakers size remain same
            const stakersAfterSecondStake = await stakingContract.getAllStakers()
            expect(stakersAfterSecondStake.length).equal(stakersBeforeSecondStake.length)

            // Stake && Unstake time updated
            expect(stakerAfterSecondStake.stakeTime.toNumber()).greaterThan(stakerBeforeSecondStake.stakeTime.toNumber())
            expect(stakerAfterSecondStake.unstakeTime.toNumber()).equal(0)

            // Staker balance updated
            const stakeAmount = await staker1Contract.stakeOf()
            const totalStakeAmount = firstStakingAmount.add(secondStakingAmount).toString()
            expect(stakeAmount.toString()).equal(totalStakeAmount)

            // Tokens transfered
            const finalStakedTokenAmount = await tokenContract.balanceOf(stakingContract.address)
            expect(finalStakedTokenAmount.sub(initialStakedTokenAmount).toString()).equal(totalStakeAmount)

            await ethers.provider.send("evm_increaseTime", [-ONE_HOUR_IN_SECONDS])
            await ethers.provider.send("evm_increaseTime", [-ONE_HOUR_IN_SECONDS])
        })

    })
})

function log(tag, text) {
    console.log(`${tag}: `, text)
}
