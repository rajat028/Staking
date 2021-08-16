const { expect, assert } = require('chai')
const { utils } = require('ethers')

function tokenOf(value) {
    return utils.parseUnits(value.toString(), 18)
}

describe("Staking Contract", () => {
    let Staking, stakingContract, owner, staker1, staker2, staker3, MockToken
    let staker1Contract
    let token1Contract
    let tokenContract
    let withdrawWithFine
    let apy = 7
    let unbondingPeriod = 10
    let pauseStatus = true;
    let stopStatus = true
    let immediateUnstakeFine = 1
    let CLAIM_DELAY = 10 * 24 * 60 * 60
    const ONE_MONTH_IN_SECONDS = 30 * 24 * 60 * 60
    const ONE_HOUR_IN_SECONDS = 60 * 60

    beforeEach(async () => {
        [owner, staker1, staker2, staker3, _] = await ethers.getSigners()
        pauseStatus = true
        stopStatus = true
        withdrawWithFine = false

        MockToken = await ethers.getContractFactory('MockToken')
        tokenContract = await MockToken.deploy()
        await tokenContract.deployed()

        Staking = await ethers.getContractFactory('Staking')
        stakingContract = await Staking.deploy(
            tokenContract.address,
            apy,
            unbondingPeriod,
            CLAIM_DELAY,
            pauseStatus,
            stopStatus,
            immediateUnstakeFine
        )
        await stakingContract.deployed()

        staker1Contract = stakingContract.connect(staker1)
        token1Contract = tokenContract.connect(staker1)
    })

    describe("Owner operations", () => {

        it("should assign the corret values", async () => {
            expect(await stakingContract.apy()).equal(apy)
            expect(await stakingContract.unbondingPeriod()).equal(unbondingPeriod)
            expect(await stakingContract.claimDelay()).equal(CLAIM_DELAY)
        })

        it("should through error if non-owner tries to update APY", async () => {
            // Given
            const APY = 10

            await expect(stakingContract.connect(staker1).updateAPY(APY, 0))
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
            await stakingContract.updateAPY(APY, 0)

            // Then
            expect(await stakingContract.apy()).equal(APY)

            const stakerAfterApyUpdated = await staker1Contract.getStaker()
            const rewardsAfterApyUpdated = stakerAfterApyUpdated.rewards
            assert.notEqual(rewardsBeforeApyUpdated.toString(), rewardsAfterApyUpdated.toString())

            await ethers.provider.send("evm_increaseTime", [-ONE_MONTH_IN_SECONDS])
        })

        it("should through error if non-owner tries to update unbondingPeriod", async () => {
            // Given
            await expect(stakingContract.connect(staker1).updateUnbondingPeriod(unbondingPeriod))
                .to.be.
                revertedWith("Ownable: caller is not the owner")
        })

        it("should be able to update unbondingPeriod by owner only", async () => {
            // Given
            unbondingPeriod = 15;

            // When
            await expect(stakingContract.updateUnbondingPeriod(unbondingPeriod))

            // Then
            expect(await stakingContract.unbondingPeriod()).equal(unbondingPeriod)
        })

        it("should through error if non-owner tries to update claimDelay", async () => {
            // Given
            await expect(stakingContract.connect(staker1).updateClaimDelay(CLAIM_DELAY))
                .to.be.
                revertedWith("Ownable: caller is not the owner")
        })

        it("should be able to update claimDelay by owner only", async () => {
            // Given
            CLAIM_DELAY = 15 * 24 * 60 * 60;

            // When
            await expect(stakingContract.updateClaimDelay(CLAIM_DELAY))

            // Then
            expect(await stakingContract.claimDelay()).equal(CLAIM_DELAY)
        })

        it("should through error if non-owner tries to update pauseState", async () => {
            // Given
            await expect(stakingContract.connect(staker1).updatePauseStatus(pauseStatus))
                .to.be.
                revertedWith("Ownable: caller is not the owner")
        })

        it("should be able to update pauseStatus by owner only", async () => {
            // Given
            pauseStatus = false;

            // When
            await stakingContract.updatePauseStatus(pauseStatus)

            // Then
            expect(await stakingContract.pauseStatus()).equal(pauseStatus)
        })

        it("should through error if non-owner tries to update stopStatus", async () => {
            // Given
            await expect(stakingContract.connect(staker1).updateStopStatus(stopStatus))
                .to.be.
                revertedWith("Ownable: caller is not the owner")
        })

        it("should be able to update stopStatus by owner only", async () => {
            // Given
            const stakingAmount = tokenOf(100)
            await tokenContract.transfer(staker1.address, stakingAmount)
            await token1Contract.approve(stakingContract.address, stakingAmount)
            await staker1Contract.stake(stakingAmount)
            stopStatus = false;

            const stakerBeforeStopStatusUpdated = await staker1Contract.getStaker()
            const rewardsBeforeStopStatusUpdated = stakerBeforeStopStatusUpdated.rewards

            await ethers.provider.send("evm_increaseTime", [ONE_MONTH_IN_SECONDS])
            await ethers.provider.send("evm_mine", [])

            // When
            await stakingContract.updateStopStatus(stopStatus)

            // Then
            expect(await stakingContract.stopStatus()).equal(stopStatus)

            const stakerAfterStopStatusUpdated = await staker1Contract.getStaker()
            const rewardsAfterStopStatusUpdated = stakerAfterStopStatusUpdated.rewards
            assert.notEqual(rewardsBeforeStopStatusUpdated.toString(), rewardsAfterStopStatusUpdated.toString())

            await ethers.provider.send("evm_increaseTime", [-ONE_MONTH_IN_SECONDS])
        })
    })

    describe("Staking Contract", () => {

        describe("Stake", () => {
            it("should not be able stake token if amount is not valid", async () => {
                // Given 
                const stakingAmount = tokenOf(0)
                await tokenContract.transfer(staker1.address, stakingAmount)
                await token1Contract.approve(stakingContract.address, stakingAmount)

                // When
                await expect(staker1Contract.stake(stakingAmount))
                    .to.be.
                    revertedWith("Invalid amount")

            })

            it("should not be to stake token when staking is paused", async () => {
                pauseStatus = false
                const stakingAmount = tokenOf(100)
                await tokenContract.transfer(staker1.address, stakingAmount)
                await token1Contract.approve(stakingContract.address, stakingAmount)
                await stakingContract.updatePauseStatus(pauseStatus)

                await expect(staker1Contract.stake(stakingAmount))
                    .to.be.
                    revertedWith("Staking not active")
            })

            it("should not be to stake token when staking is stopped", async () => {
                stopStatus = false
                const stakingAmount = tokenOf(100)
                await tokenContract.transfer(staker1.address, stakingAmount)
                await token1Contract.approve(stakingContract.address, stakingAmount)
                await stakingContract.updateStopStatus(stopStatus)

                await expect(staker1Contract.stake(stakingAmount))
                    .to.be.
                    revertedWith("Staking not active")
            })

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
        })

        describe("Unstake", () => {

            it("should not be able to unstake when not a staker", async () => {
                await expect(stakingContract.connect(staker2).unstake(withdrawWithFine))
                    .to.be.
                    revertedWith("Not a staker")
            })

            it.only("should be able to request for unstake ", async () => {
                // Given 
                const stakingAmount = tokenOf(100)
                await tokenContract.transfer(staker1.address, stakingAmount)
                await token1Contract.approve(stakingContract.address, stakingAmount)
                staker1Contract.stake(stakingAmount)

                // When
                await staker1Contract.unstake(withdrawWithFine)
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
                await staker1Contract.unstake(withdrawWithFine)

                await expect(staker1Contract.unstake(withdrawWithFine))
                    .to.be.
                    revertedWith("Already Unstaked")
            })

            it("should be able to unstake and withdraw when unbonding period is 0", async () => {
                // Given 
                const stakingAmount = tokenOf(100)
                const supplyAmount = tokenOf(1000)
                await tokenContract.transfer(staker1.address, stakingAmount)
                await token1Contract.approve(stakingContract.address, stakingAmount)
                await tokenContract.transfer(stakingContract.address, supplyAmount)
                staker1Contract.stake(stakingAmount)
                stakingContract.updateUnbondingPeriod(0)

                // When
                await staker1Contract.unstake(withdrawWithFine)

                // Then
                const stakerAfterWithdraw = await staker1Contract.getStaker()
                assert.notEqual(stakerAfterWithdraw.unstakeTime, 0)

                const stakesAfterWithdraw = stakerAfterWithdraw.balance;
                const rewardsAfterWithdraw = stakerAfterWithdraw.rewards;
                const rewardsClaimedTimeAfterWithdraw = stakerAfterWithdraw.rewardsClaimedTime;
                expect(stakesAfterWithdraw.toString()).equal("0")
                expect(rewardsAfterWithdraw.toString()).equal("0")
                expect(rewardsClaimedTimeAfterWithdraw.toString()).equal("0")
            })

            it.only("should be able to unstake and withdraw when user opted for unstaking with fine", async () => {
                // Given 
                withdrawWithFine = true
                const stakingAmount = tokenOf(100)
                const supplyAmount = tokenOf(1000)
                await tokenContract.transfer(staker1.address, stakingAmount)
                await token1Contract.approve(stakingContract.address, stakingAmount)
                await tokenContract.transfer(stakingContract.address, supplyAmount)
                staker1Contract.stake(stakingAmount)

                // When
                await staker1Contract.unstake(withdrawWithFine)

                // Then
                const stakerAfterWithdraw = await staker1Contract.getStaker()
                assert.notEqual(stakerAfterWithdraw.unstakeTime, 0)

                const stakesAfterWithdraw = stakerAfterWithdraw.balance;
                const rewardsAfterWithdraw = stakerAfterWithdraw.rewards;
                const rewardsClaimedTimeAfterWithdraw = stakerAfterWithdraw.rewardsClaimedTime;
                expect(stakesAfterWithdraw.toString()).equal("0")
                expect(rewardsAfterWithdraw.toString()).equal("0")
                expect(rewardsClaimedTimeAfterWithdraw.toString()).equal("0")
            })
        })

        it("should not be able to claim rewards if not staker", async () => {
            await expect(stakingContract.connect(staker2).claimRewards())
                .to.be.
                revertedWith("Not a staker")
        })

        it("should not be able to claim rewards if claim delay is not over", async () => {
            // Given 
            const stakingAmount = tokenOf(100)
            await tokenContract.transfer(staker1.address, stakingAmount)
            await token1Contract.approve(stakingContract.address, stakingAmount)
            await staker1Contract.stake(stakingAmount)

            await ethers.provider.send("evm_increaseTime", [ONE_HOUR_IN_SECONDS])
            await ethers.provider.send("evm_mine", [])

            // When & Then
            await expect(staker1Contract.claimRewards())
                .to.be.
                revertedWith("Rewards cannot claimed")

            await ethers.provider.send("evm_increaseTime", [-ONE_HOUR_IN_SECONDS])
        })


        it("should be able to claim rewards when unstake not requested and claim delay is over", async () => {
            // Given 
            const stakingAmount = tokenOf(100)
            await tokenContract.transfer(staker1.address, stakingAmount)
            await token1Contract.approve(stakingContract.address, stakingAmount)
            await staker1Contract.stake(stakingAmount)

            await ethers.provider.send("evm_increaseTime", [ONE_MONTH_IN_SECONDS])
            await ethers.provider.send("evm_mine", [])

            // When
            const stakerBeforeRewardsClaimed = await staker1Contract.getStaker()
            const rewards = await stakingContract.rewardsOf(staker1.address)
            await staker1Contract.claimRewards()

            // Then
            const formattedRewards = rewards.toString().substring(0, 3)
            const finalBalance = await tokenContract.balanceOf(staker1.address)
            expect(formattedRewards).equal(finalBalance.toString().substring(0, 3))

            const stakerAfterRewardsClaimed = await staker1Contract.getStaker()

            expect(stakerAfterRewardsClaimed.rewardsClaimedTime.toNumber())
                .greaterThan(stakerBeforeRewardsClaimed.rewardsClaimedTime.toNumber())
            expect(stakerAfterRewardsClaimed.rewards).equal(0)

            await ethers.provider.send("evm_increaseTime", [-ONE_MONTH_IN_SECONDS])
        })

        it("should not be able to withdraw if not staker", async () => {
            await expect(stakingContract.connect(staker2).withdraw(withdrawWithFine))
                .to.be.
                revertedWith("Not a staker")
        })

        it("should not be able to withdraw if unstake not requested", async () => {
            const stakingAmount = tokenOf(100)
            await tokenContract.transfer(staker1.address, stakingAmount)
            await token1Contract.approve(stakingContract.address, stakingAmount)
            await staker1Contract.stake(stakingAmount)

            await expect(staker1Contract.withdraw(withdrawWithFine))
                .to.be.
                revertedWith("Unstake not requested")
        })

        it("should not be able to withdraw if unbonding period is not over", async () => {
            // Given 
            // Given 
            // Given 
            const stakingAmount = tokenOf(100)
            const supplyAmount = tokenOf(1000)
            await tokenContract.transfer(staker1.address, stakingAmount)
            await token1Contract.approve(stakingContract.address, stakingAmount)
            await tokenContract.transfer(stakingContract.address, supplyAmount)
            await staker1Contract.stake(stakingAmount)

            await ethers.provider.send("evm_increaseTime", [ONE_HOUR_IN_SECONDS])
            await ethers.provider.send("evm_mine", [])

            await staker1Contract.unstake(withdrawWithFine)

            // When & Then
            await expect(staker1Contract.withdraw(withdrawWithFine))
                .to.be.
                revertedWith("Unbonding not over")
        })

        it("should be able to withdraw if unbounding period is over", async () => {
            // Given 
            const stakingAmount = tokenOf(100)
            const supplyAmount = tokenOf(1000)
            await tokenContract.transfer(staker1.address, stakingAmount)
            await token1Contract.approve(stakingContract.address, stakingAmount)
            await tokenContract.transfer(stakingContract.address, supplyAmount)
            await staker1Contract.stake(stakingAmount)

            await ethers.provider.send("evm_increaseTime", [ONE_HOUR_IN_SECONDS])
            await ethers.provider.send("evm_mine", [])

            await staker1Contract.unstake(withdrawWithFine)

            await ethers.provider.send("evm_increaseTime", [ONE_HOUR_IN_SECONDS])
            await ethers.provider.send("evm_mine", [])

            let initialBalance = await tokenContract.balanceOf(staker1.address);
            let stakesBeforeWithdraw = await staker1Contract.stakeOf();
            let rewardsBeforeWithdraw = await stakingContract.rewardsOf(staker1.address)

            // When
            await staker1Contract.withdraw(withdrawWithFine)

            // Then
            const stakerAfterWithdraw = await staker1Contract.getStaker()
            const stakesAfterWithdraw = stakerAfterWithdraw.balance;
            const rewardsAfterWithdraw = stakerAfterWithdraw.rewards;
            const rewardsClaimedTimeAfterWithdraw = stakerAfterWithdraw.rewardsClaimedTime;
            expect(stakesAfterWithdraw.toString()).equal("0")
            expect(rewardsAfterWithdraw.toString()).equal("0")
            expect(rewardsClaimedTimeAfterWithdraw.toString()).equal("0")

            let balanceAfterWithdraw = await tokenContract.balanceOf(staker1.address)
            const result = initialBalance.add(stakesBeforeWithdraw.add(rewardsBeforeWithdraw))
            expect(result.toString()).equal(balanceAfterWithdraw.toString())

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

            await staker1Contract.unstake(withdrawWithFine)

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

        it.skip("Batching", async () => {
            await stakingContract.batchingLogic()
        })

    })
})

function log(tag, text) {
    console.log(`${tag}: `, text)
}
