import { ConstantProductAMM__factory } from "./../typechain-types/factories/contracts/ConstantProductAMM__factory";
import { MockToken__factory } from "./../typechain-types/factories/contracts/MockToken__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { ConstantProductAMM, MockToken } from "../typechain-types";
import { BigNumber } from "ethers";

describe("ConstantProductAmm.sol", () => {
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let MockToken0: MockToken__factory;
  let mockToken0: MockToken;
  let MockToken1: MockToken__factory;
  let mockToken1: MockToken;
  let ConstantProductAMM: ConstantProductAMM__factory;
  let constantProductAMM: ConstantProductAMM;

  let mintAmount = 1000;
  let swapAmount = 100;
  let token0LiquidityAmount = 1000;
  let token1LiquidityAmount = 500;

  const calculatedTotalSupply = Math.floor(
    Math.sqrt(token0LiquidityAmount * token1LiquidityAmount)
  );

  before(async () => {
    [owner, user1, user2] = await ethers.getSigners();
    MockToken0 = await ethers.getContractFactory("MockToken");
    mockToken0 = await MockToken0.deploy();
    MockToken1 = await ethers.getContractFactory("MockToken");
    mockToken1 = await MockToken1.deploy();
    ConstantProductAMM = await ethers.getContractFactory("ConstantProductAMM");
    constantProductAMM = await ConstantProductAMM.deploy(
      mockToken0.address,
      mockToken1.address
    );
    //mint some token for testing and approve the marketplace to spend
    await mockToken0.connect(user1).mint(user1.address, mintAmount);
    await mockToken0
      .connect(user1)
      .approve(constantProductAMM.address, mintAmount);
    await mockToken1.connect(user1).mint(user1.address, mintAmount);
    await mockToken1
      .connect(user1)
      .approve(constantProductAMM.address, mintAmount);

    await mockToken0.connect(user2).mint(user2.address, mintAmount);
    await mockToken0
      .connect(user2)
      .approve(constantProductAMM.address, mintAmount);
    await mockToken1.connect(user2).mint(user2.address, mintAmount);
    await mockToken1
      .connect(user2)
      .approve(constantProductAMM.address, mintAmount);
  });

  describe("Testing add and remove liquidity and swap", () => {
    describe("Add liquidity", () => {
      before(async () => {
        //user1 provide liquidity
        await constantProductAMM
          .connect(user1)
          .addLiquidity(token0LiquidityAmount, token1LiquidityAmount);
      });

      it("Should update reserve0", async () => {
        const reserve0 = await constantProductAMM.reserve0();
        expect(reserve0).equal(token0LiquidityAmount);
      });
      it("Should update reserve1", async () => {
        const reserve1 = await constantProductAMM.reserve1();
        expect(reserve1).equal(token1LiquidityAmount);
      });
      it("Should update total supply", async () => {
        const totaltSupply = await constantProductAMM.totalSupply();
        expect(totaltSupply).equal(calculatedTotalSupply);
      });
      it("Should update balance of user 1", async () => {
        const balanceOfUser1 = await constantProductAMM.balanceOf(
          user1.address
        );
        expect(balanceOfUser1).equal(calculatedTotalSupply);
      });
    });

    describe("Swap", () => {
      let user2Balance1Before: BigNumber;
      before(async () => {
        user2Balance1Before = await mockToken1.balanceOf(user2.address);
        //user2 swap 100 token0
        await constantProductAMM
          .connect(user2)
          .swap(mockToken0.address, swapAmount);
      });
      it("Should increase the balance of user2 after swapping", async () => {
        const user2Balance1After = await mockToken1.balanceOf(user2.address);
        expect(user2Balance1After).greaterThan(user2Balance1Before);
      });
    });
    describe("Remove liquidity after swapping", () => {
      before(async () => {
        //remove all liquidity for user1
        await constantProductAMM
          .connect(user1)
          .removeLiquidity(calculatedTotalSupply);
      });
      it("Should update reserve0", async () => {
        const reserve0 = await constantProductAMM.reserve0();
        expect(reserve0).equal(0);
      });
      it("Should update reserve1", async () => {
        const reserve1 = await constantProductAMM.reserve1();
        expect(reserve1).equal(0);
      });
      it("Should update user1 token 0 balance", async () => {
        //should expect more after user2 swapped
        const user1Balance0 = await mockToken0.balanceOf(user1.address);
        expect(user1Balance0).greaterThan(mintAmount);
      });
      it("Should update user1 token 1 balance", async () => {
        //should expect less after user2 swapped
        const user1Balance1 = await mockToken1.balanceOf(user1.address);
        expect(user1Balance1).lessThan(mintAmount);
      });
    });
  });
});
