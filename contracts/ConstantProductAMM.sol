// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

error ConstantProductAMM__InvalidToken();
error ConstantProductAMM__InvalidAmount();
error ConstantProductAMM__InvalidAssetPrice();
error ConstantProductAMM__InvalidShares();

contract ConstantProductAMM {
    IERC20 public immutable token0;
    IERC20 public immutable token1;

    uint public reserve0;
    uint public reserve1;

    uint public totalSupply;
    mapping(address => uint) public balanceOf;

    constructor(address _token0, address _token1) {
        token0 = IERC20(_token0);
        token1 = IERC20(_token1);
    }

    function _mint(address _to, uint _amount) private {
        balanceOf[_to] += _amount;
        totalSupply += _amount;
    }

    function _burn(address _from, uint _amount) private {
        balanceOf[_from] -= _amount;
        totalSupply -= _amount;
    }

    function _updateReserve(uint _reserve0, uint _reserve1) private {
        reserve0 = _reserve0;
        reserve1 = _reserve1;
    }

    function sqrt(uint x) public pure returns (uint y) {
        uint z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function _min(uint x, uint y) private pure returns (uint) {
        return x <= y ? x : y;
    }

    function swap(address _tokenIn, uint _amountIn)
        external
        returns (uint amountOut)
    {
        /**
         * error checking
         */
        if (_tokenIn != address(token0) && _tokenIn != address(token1))
            revert ConstantProductAMM__InvalidToken();
        if (_amountIn <= 0) revert ConstantProductAMM__InvalidAmount();

        /**
         * identify which token coming in
         */
        bool isToken0 = _tokenIn == address(token0);
        (
            IERC20 tokenIn,
            IERC20 tokenOut,
            uint reserveIn,
            uint reserveOut
        ) = isToken0
                ? (token0, token1, reserve0, reserve1)
                : (token1, token0, reserve1, reserve0);
        tokenIn.transferFrom(msg.sender, address(this), _amountIn);

        // 0.3% fee
        uint amountInWithFee = (_amountIn * 997) / 1000;
        amountOut =
            (reserveOut * amountInWithFee) /
            (reserveIn + amountInWithFee);
        tokenOut.transfer(msg.sender, amountOut);

        // update the reserve
        _updateReserve(
            token0.balanceOf(address(this)),
            token1.balanceOf(address(this))
        );
    }

    function addLiquidity(uint _amount0, uint _amount1)
        external
        returns (uint shares)
    {
        // transfer tokens to this address
        token0.transferFrom(msg.sender, address(this), _amount0);
        token1.transferFrom(msg.sender, address(this), _amount1);

        // make sure the price not changed after adding liquidity
        if (_amount0 <= 0 || _amount1 <= 0)
            revert ConstantProductAMM__InvalidAmount();
        if (reserve1 * _amount0 != reserve0 * _amount1)
            revert ConstantProductAMM__InvalidAssetPrice();

        /**
         * shares = sqrt(x * y) or
         * shares = dx / x * t = dy / y * t
         */
        if (totalSupply == 0) {
            shares = sqrt(_amount0 * _amount1);
        } else {
            shares = _min(
                (_amount0 * totalSupply) / reserve0,
                (_amount1 * totalSupply) / reserve1
            );
        }

        //error checking
        if (shares <= 0) revert ConstantProductAMM__InvalidShares();

        //mint
        _mint(msg.sender, shares);
        _updateReserve(
            token0.balanceOf(address(this)),
            token1.balanceOf(address(this))
        );
    }

    function removeLiquidity(uint _shares)
        external
        returns (uint amount0, uint amount1)
    {
        uint balance0 = token0.balanceOf(address(this));
        uint balance1 = token1.balanceOf(address(this));

        //calculate the amount to burn
        amount0 = (_shares * balance0) / totalSupply;
        amount1 = (_shares * balance1) / totalSupply;
        if (amount0 <= 0 || amount1 <= 0)
            revert ConstantProductAMM__InvalidAmount();

        //burn shares
        _burn(msg.sender, _shares);

        _updateReserve(balance0 - amount0, balance1 - amount1);
        //send to user
        token0.transfer(msg.sender, amount0);
        token1.transfer(msg.sender, amount1);
    }
}
