import { Hono } from "hono";
import { JsonRpcProvider, Contract } from "ethers";

const pools = new Hono();

const POOL_REGISTRY_ABI = [
  "function getPoolCount() view returns (uint256)",
  "function getPoolByIndex(uint256) view returns (address token, address pool)",
  "function getPool(address token) view returns (address)",
];

const ERC20_ABI = [
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function balanceOf(address) view returns (uint256)",
];

const POOL_ABI = [
  "function getRoot() view returns (uint256)",
  "function getNextLeafIndex() view returns (uint256)",
];

function getProvider(): JsonRpcProvider {
  const rpcUrl =
    process.env.AVALANCHE_RPC_URL ||
    "https://api.avax-test.network/ext/bc/C/rpc";
  return new JsonRpcProvider(rpcUrl);
}

// GET /v1/pools — List all shielded pools
pools.get("/", async (c) => {
  const registryAddress = process.env.POOL_REGISTRY_ADDRESS;
  if (!registryAddress) {
    return c.json({ error: "Pool registry not configured" }, 503);
  }

  try {
    const provider = getProvider();
    const registry = new Contract(
      registryAddress,
      POOL_REGISTRY_ABI,
      provider
    );

    const count = await registry.getPoolCount();
    const poolList = [];

    for (let i = 0; i < Number(count); i++) {
      const [tokenAddr, poolAddr] = await registry.getPoolByIndex(i);
      const token = new Contract(tokenAddr, ERC20_ABI, provider);

      const [symbol, decimals, name, poolBalance] = await Promise.all([
        token.symbol(),
        token.decimals(),
        token.name(),
        token.balanceOf(poolAddr),
      ]);

      poolList.push({
        token: {
          address: tokenAddr,
          symbol,
          name,
          decimals: Number(decimals),
        },
        pool: {
          address: poolAddr,
          totalDeposited: poolBalance.toString(),
        },
      });
    }

    return c.json({ pools: poolList });
  } catch (err) {
    console.error("Pool list error:", err);
    return c.json({ error: "Failed to fetch pools" }, 500);
  }
});

// GET /v1/pools/:token — Pool info for a specific token
pools.get("/:token", async (c) => {
  const tokenParam = c.req.param("token");
  const registryAddress = process.env.POOL_REGISTRY_ADDRESS;
  if (!registryAddress) {
    return c.json({ error: "Pool registry not configured" }, 503);
  }

  try {
    const provider = getProvider();
    const registry = new Contract(
      registryAddress,
      POOL_REGISTRY_ABI,
      provider
    );

    const poolAddr = await registry.getPool(tokenParam);
    if (poolAddr === "0x0000000000000000000000000000000000000000") {
      return c.json({ error: "Pool not found for token" }, 404);
    }

    const token = new Contract(tokenParam, ERC20_ABI, provider);
    const pool = new Contract(poolAddr, POOL_ABI, provider);

    const [symbol, decimals, name, poolBalance, root, nextLeaf] =
      await Promise.all([
        token.symbol(),
        token.decimals(),
        token.name(),
        token.balanceOf(poolAddr),
        pool.getRoot(),
        pool.getNextLeafIndex(),
      ]);

    return c.json({
      token: {
        address: tokenParam,
        symbol,
        name,
        decimals: Number(decimals),
      },
      pool: {
        address: poolAddr,
        totalDeposited: poolBalance.toString(),
        merkleRoot: root.toString(),
        activeCommitments: Number(nextLeaf),
      },
    });
  } catch (err) {
    console.error("Pool info error:", err);
    return c.json({ error: "Failed to fetch pool info" }, 500);
  }
});

export { pools };
