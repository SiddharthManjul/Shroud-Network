// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TestToken
 * @notice Faucet-style ERC20 for testing on Fuji. No OpenZeppelin dependency.
 *
 *   name     = "Shroud"
 *   symbol   = "SHROUD"
 *   decimals = 18
 *
 *   faucet()              → mints 1 000 tokens to caller
 *   faucet(uint256 amount) → mints up to 10 000 tokens per call
 */
contract TestToken {
    string public constant name     = "Shroud";
    string public constant symbol   = "SRD";
    uint8  public constant decimals = 18;

    uint256 public totalSupply;

    mapping(address => uint256)                      public balanceOf;
    mapping(address => mapping(address => uint256))  public allowance;

    uint256 private constant MAX_FAUCET = 10_000 * 1e18;
    uint256 private constant DEFAULT_FAUCET = 1_000 * 1e18;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ── Faucet ──────────────────────────────────────────────────────────────

    function faucet() external {
        _mint(msg.sender, DEFAULT_FAUCET);
    }

    function faucet(uint256 amount) external {
        require(amount <= MAX_FAUCET, "TestToken: max 10000 per call");
        _mint(msg.sender, amount);
    }

    // ── ERC20 ───────────────────────────────────────────────────────────────

    function transfer(address to, uint256 amount) external returns (bool) {
        return _transfer(msg.sender, to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "TestToken: allowance exceeded");
            unchecked { allowance[from][msg.sender] = allowed - amount; }
        }
        return _transfer(from, to, amount);
    }

    // ── Internal ────────────────────────────────────────────────────────────

    function _transfer(address from, address to, uint256 amount) internal returns (bool) {
        require(to != address(0), "TestToken: transfer to zero");
        require(balanceOf[from] >= amount, "TestToken: insufficient balance");
        unchecked {
            balanceOf[from] -= amount;
            balanceOf[to]   += amount;
        }
        emit Transfer(from, to, amount);
        return true;
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        unchecked { balanceOf[to] += amount; }
        emit Transfer(address(0), to, amount);
    }
}
