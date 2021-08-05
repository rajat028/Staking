Use Casses
- Usecase 1: 
  - APY 100% -> User 1 comes and stakes 100 tokens -> After a year total will be 200 tokens
  - Now after 6 months of initial stake user 1 again contributes 100 tokens
  - Now at the end of 1st year user 1 should have 350 tokens
- Usercase 2 -> User unstake and stakes again in unbounding period
- Usecase 3 -> User withdraws his rewards only
- Usecase 4 -> Owner updates the APY
- Usecase 5 -> Owner updates the unbounding period

Features
- Pause Staking -> Rewards will continue to update, but staking will not work.
- Close Staking -> Rewards updation and staking process both will stop.
- Claim Delay -> User can claim after the delay period is over. (for eg : delay period is 10 days)
  - Usecase 1 - After staking user will be able to claim rewards delay period is over.
  - Usecase 2 - If user claim rewards on 10th then the user will be eligible on 21st.
  - Usecase 3 - If user claim rewards after 15days then the user will be eligible to claim rewards after (last claim time + delay period).