// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ShieldedPool} from "../src/ShieldedPool.sol";
import {MetaTxRelayer} from "../src/MetaTxRelayer.sol";
import {IVerifier} from "../src/interfaces/IVerifier.sol";

// ─── Mock contracts ─────────────────────────────────────────────────────────

contract MockToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "ERC20: insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "ERC20: insufficient balance");
        require(allowance[from][msg.sender] >= amount, "ERC20: insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract MockPoseidon {
    uint256 internal constant P =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    function poseidon(uint256[2] calldata inputs) external pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(inputs[0], inputs[1]))) % P;
    }
}

contract MockVerifier is IVerifier {
    bool private _shouldPass;
    constructor(bool shouldPass) { _shouldPass = shouldPass; }
    function setShouldPass(bool v) external { _shouldPass = v; }
    function verifyProof(
        uint256[2] calldata, uint256[2][2] calldata,
        uint256[2] calldata, uint256[4] calldata
    ) external view returns (bool) { return _shouldPass; }
}

function dummyProof() pure returns (bytes memory) {
    return new bytes(256);
}

// ─── Test suite ──────────────────────────────────────────────────────────────

contract MetaTxRelayerTest is Test {
    MockToken token;
    MockPoseidon poseidon;
    MockVerifier transferVerifier;
    MockVerifier withdrawVerifier;
    ShieldedPool pool;
    MetaTxRelayer relayer;

    uint256 constant ALICE_PK = 0xA11CE;
    address alice;
    address relayWallet = makeAddr("relayWallet");
    address bob = makeAddr("bob");

    uint256 constant SCALE = 1e18;
    uint256 constant DEP_AMT = 1000;
    uint256 constant WD_AMT = 500;
    uint256 constant FEE = 1;
    uint256 constant C1 = 111;
    uint256 constant C2 = 222;
    uint256 constant C3 = 333;
    uint256 constant NULL1 = 999;

    bytes32 domSep;
    bytes32 constant DEP_TH = keccak256(
        "RelayDeposit(address depositor,address pool,uint256 amount,uint256 commitment,uint256 fee,uint256 deadline,uint256 nonce)"
    );
    bytes32 constant WD_TH = keccak256(
        "RelayWithdraw(address withdrawer,address pool,bytes32 proofHash,uint256 merkleRoot,uint256 nullifierHash,uint256 amount,uint256 changeCommitment,address recipient,uint256 fee,uint256 deadline,uint256 nonce)"
    );

    function setUp() public {
        alice = vm.addr(ALICE_PK);
        token = new MockToken();
        poseidon = new MockPoseidon();
        transferVerifier = new MockVerifier(true);
        withdrawVerifier = new MockVerifier(true);

        pool = new ShieldedPool(
            address(token), address(transferVerifier),
            address(withdrawVerifier), address(poseidon), SCALE
        );

        relayer = new MetaTxRelayer();
        domSep = relayer.DOMAIN_SEPARATOR();

        // Fund alice, approve relayer + pool
        token.mint(alice, 100_000 * SCALE);
        vm.startPrank(alice);
        token.approve(address(relayer), type(uint256).max);
        token.approve(address(pool), type(uint256).max);
        pool.deposit(DEP_AMT, C1); // seed pool for withdraw tests
        vm.stopPrank();

        vm.deal(relayWallet, 10 ether);
    }

    // ─── Signing helpers ─────────────────────────────────────────────────────

    function _signDep(
        uint256 pk, address dep, uint256 amt, uint256 com,
        uint256 fee, uint256 dl, uint256 n
    ) internal view returns (bytes memory) {
        bytes32 sh = keccak256(abi.encode(DEP_TH, dep, address(pool), amt, com, fee, dl, n));
        bytes32 dig = keccak256(abi.encodePacked("\x19\x01", domSep, sh));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, dig);
        return abi.encodePacked(r, s, v);
    }

    function _signWd(
        uint256 pk, address wd, bytes memory proof, uint256 root,
        uint256 nul, uint256 amt, uint256 cc, address rec,
        uint256 fee, uint256 dl, uint256 n
    ) internal view returns (bytes memory) {
        bytes32 ph = keccak256(proof);
        bytes32 sh = keccak256(abi.encode(
            WD_TH, wd, address(pool), ph, root, nul, amt, cc, rec, fee, dl, n
        ));
        bytes32 dig = keccak256(abi.encodePacked("\x19\x01", domSep, sh));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, dig);
        return abi.encodePacked(r, s, v);
    }

    // ─── Struct builders ─────────────────────────────────────────────────────

    function _depReq(
        address dep, uint256 amt, uint256 com, uint256 fee,
        uint256 dl, uint256 n, bytes memory sig
    ) internal view returns (MetaTxRelayer.DepositRequest memory) {
        return MetaTxRelayer.DepositRequest(dep, address(pool), amt, com, fee, dl, n, sig);
    }

    function _wdReq(
        address wd, bytes memory proof, uint256 root, uint256 nul,
        uint256 amt, uint256 cc, address rec, uint256 fee,
        uint256 dl, uint256 n, bytes memory sig
    ) internal view returns (MetaTxRelayer.WithdrawRequest memory) {
        return MetaTxRelayer.WithdrawRequest(
            wd, address(pool), proof, root, nul, amt, cc, rec, "", fee, dl, n, sig
        );
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  relayDeposit
    // ═════════════════════════════════════════════════════════════════════════

    function test_relayDeposit_succeeds() public {
        uint256 dl = block.timestamp + 1 hours;
        bytes memory sig = _signDep(ALICE_PK, alice, DEP_AMT, C2, FEE, dl, 0);

        uint256 alicePre = token.balanceOf(alice);
        uint256 relayPre = token.balanceOf(relayWallet);
        uint256 poolPre  = token.balanceOf(address(pool));

        vm.prank(relayWallet);
        relayer.relayDeposit(_depReq(alice, DEP_AMT, C2, FEE, dl, 0, sig));

        assertEq(token.balanceOf(alice),        alicePre - (DEP_AMT + FEE) * SCALE);
        assertEq(token.balanceOf(address(pool)), poolPre + DEP_AMT * SCALE);
        assertEq(token.balanceOf(relayWallet),   relayPre + FEE * SCALE);
        assertEq(relayer.nonces(alice), 1);
    }

    function test_relayDeposit_zeroFee() public {
        uint256 dl = block.timestamp + 1 hours;
        bytes memory sig = _signDep(ALICE_PK, alice, DEP_AMT, C2, 0, dl, 0);

        vm.prank(relayWallet);
        relayer.relayDeposit(_depReq(alice, DEP_AMT, C2, 0, dl, 0, sig));
        assertEq(relayer.nonces(alice), 1);
    }

    function test_relayDeposit_emitsEvent() public {
        uint256 dl = block.timestamp + 1 hours;
        bytes memory sig = _signDep(ALICE_PK, alice, DEP_AMT, C2, FEE, dl, 0);

        vm.expectEmit(true, true, false, true);
        emit MetaTxRelayer.RelayedDeposit(alice, address(pool), DEP_AMT, FEE, C2);

        vm.prank(relayWallet);
        relayer.relayDeposit(_depReq(alice, DEP_AMT, C2, FEE, dl, 0, sig));
    }

    function test_relayDeposit_revertsExpiredDeadline() public {
        uint256 dl = block.timestamp - 1;
        bytes memory sig = _signDep(ALICE_PK, alice, DEP_AMT, C2, FEE, dl, 0);

        vm.prank(relayWallet);
        vm.expectRevert("MetaTxRelayer: expired deadline");
        relayer.relayDeposit(_depReq(alice, DEP_AMT, C2, FEE, dl, 0, sig));
    }

    function test_relayDeposit_revertsInvalidNonce() public {
        uint256 dl = block.timestamp + 1 hours;
        bytes memory sig = _signDep(ALICE_PK, alice, DEP_AMT, C2, FEE, dl, 1);

        vm.prank(relayWallet);
        vm.expectRevert("MetaTxRelayer: invalid nonce");
        relayer.relayDeposit(_depReq(alice, DEP_AMT, C2, FEE, dl, 1, sig));
    }

    function test_relayDeposit_revertsReplay() public {
        uint256 dl = block.timestamp + 1 hours;
        bytes memory sig = _signDep(ALICE_PK, alice, DEP_AMT, C2, FEE, dl, 0);

        vm.prank(relayWallet);
        relayer.relayDeposit(_depReq(alice, DEP_AMT, C2, FEE, dl, 0, sig));

        vm.prank(relayWallet);
        vm.expectRevert("MetaTxRelayer: invalid nonce");
        relayer.relayDeposit(_depReq(alice, DEP_AMT, C2, FEE, dl, 0, sig));
    }

    function test_relayDeposit_revertsWrongSigner() public {
        uint256 dl = block.timestamp + 1 hours;
        bytes memory sig = _signDep(0xDEAD, alice, DEP_AMT, C2, FEE, dl, 0);

        vm.prank(relayWallet);
        vm.expectRevert("MetaTxRelayer: signer mismatch");
        relayer.relayDeposit(_depReq(alice, DEP_AMT, C2, FEE, dl, 0, sig));
    }

    function test_relayDeposit_revertsModifiedAmount() public {
        uint256 dl = block.timestamp + 1 hours;
        bytes memory sig = _signDep(ALICE_PK, alice, DEP_AMT, C2, FEE, dl, 0);

        vm.prank(relayWallet);
        vm.expectRevert("MetaTxRelayer: signer mismatch");
        relayer.relayDeposit(_depReq(alice, 2000, C2, FEE, dl, 0, sig));
    }

    function test_relayDeposit_sequentialNonces() public {
        uint256 dl = block.timestamp + 1 hours;

        bytes memory sig0 = _signDep(ALICE_PK, alice, 100, C2, FEE, dl, 0);
        vm.prank(relayWallet);
        relayer.relayDeposit(_depReq(alice, 100, C2, FEE, dl, 0, sig0));

        bytes memory sig1 = _signDep(ALICE_PK, alice, 100, C3, FEE, dl, 1);
        vm.prank(relayWallet);
        relayer.relayDeposit(_depReq(alice, 100, C3, FEE, dl, 1, sig1));

        assertEq(relayer.nonces(alice), 2);
    }

    // ═════════════════════════════════════════════════════════════════════════
    //  relayWithdraw
    // ═════════════════════════════════════════════════════════════════════════

    function test_relayWithdraw_succeeds() public {
        uint256 root = pool.getRoot();
        bytes memory proof = dummyProof();
        uint256 dl = block.timestamp + 1 hours;
        bytes memory sig = _signWd(ALICE_PK, alice, proof, root, NULL1, WD_AMT, 0, bob, FEE, dl, 0);

        uint256 poolPre  = token.balanceOf(address(pool));
        uint256 bobPre   = token.balanceOf(bob);
        uint256 relayPre = token.balanceOf(relayWallet);

        vm.prank(relayWallet);
        relayer.relayWithdraw(_wdReq(alice, proof, root, NULL1, WD_AMT, 0, bob, FEE, dl, 0, sig));

        assertEq(token.balanceOf(address(pool)), poolPre - WD_AMT * SCALE);
        assertEq(token.balanceOf(bob),           bobPre + (WD_AMT - FEE) * SCALE);
        assertEq(token.balanceOf(relayWallet),   relayPre + FEE * SCALE);
        assertEq(relayer.nonces(alice), 1);
        assertTrue(pool.nullifiers(NULL1));
    }

    function test_relayWithdraw_zeroFee() public {
        uint256 root = pool.getRoot();
        bytes memory proof = dummyProof();
        uint256 dl = block.timestamp + 1 hours;
        bytes memory sig = _signWd(ALICE_PK, alice, proof, root, NULL1, WD_AMT, 0, bob, 0, dl, 0);

        vm.prank(relayWallet);
        relayer.relayWithdraw(_wdReq(alice, proof, root, NULL1, WD_AMT, 0, bob, 0, dl, 0, sig));

        assertEq(token.balanceOf(bob), WD_AMT * SCALE);
    }

    function test_relayWithdraw_emitsEvent() public {
        uint256 root = pool.getRoot();
        bytes memory proof = dummyProof();
        uint256 dl = block.timestamp + 1 hours;
        bytes memory sig = _signWd(ALICE_PK, alice, proof, root, NULL1, WD_AMT, 0, bob, FEE, dl, 0);

        vm.expectEmit(true, true, false, true);
        emit MetaTxRelayer.RelayedWithdraw(alice, address(pool), WD_AMT, FEE, bob);

        vm.prank(relayWallet);
        relayer.relayWithdraw(_wdReq(alice, proof, root, NULL1, WD_AMT, 0, bob, FEE, dl, 0, sig));
    }

    function test_relayWithdraw_revertsExpiredDeadline() public {
        uint256 root = pool.getRoot();
        bytes memory proof = dummyProof();
        uint256 dl = block.timestamp - 1;
        bytes memory sig = _signWd(ALICE_PK, alice, proof, root, NULL1, WD_AMT, 0, bob, FEE, dl, 0);

        vm.prank(relayWallet);
        vm.expectRevert("MetaTxRelayer: expired deadline");
        relayer.relayWithdraw(_wdReq(alice, proof, root, NULL1, WD_AMT, 0, bob, FEE, dl, 0, sig));
    }

    function test_relayWithdraw_revertsFeeGteAmount() public {
        uint256 root = pool.getRoot();
        bytes memory proof = dummyProof();
        uint256 dl = block.timestamp + 1 hours;
        bytes memory sig = _signWd(ALICE_PK, alice, proof, root, NULL1, WD_AMT, 0, bob, WD_AMT, dl, 0);

        vm.prank(relayWallet);
        vm.expectRevert("MetaTxRelayer: fee >= amount");
        relayer.relayWithdraw(_wdReq(alice, proof, root, NULL1, WD_AMT, 0, bob, WD_AMT, dl, 0, sig));
    }

    function test_relayWithdraw_revertsZeroRecipient() public {
        uint256 root = pool.getRoot();
        bytes memory proof = dummyProof();
        uint256 dl = block.timestamp + 1 hours;
        bytes memory sig = _signWd(ALICE_PK, alice, proof, root, NULL1, WD_AMT, 0, address(0), FEE, dl, 0);

        vm.prank(relayWallet);
        vm.expectRevert("MetaTxRelayer: zero recipient");
        relayer.relayWithdraw(_wdReq(alice, proof, root, NULL1, WD_AMT, 0, address(0), FEE, dl, 0, sig));
    }

    function test_relayWithdraw_revertsWrongSigner() public {
        uint256 root = pool.getRoot();
        bytes memory proof = dummyProof();
        uint256 dl = block.timestamp + 1 hours;
        bytes memory sig = _signWd(0xDEAD, alice, proof, root, NULL1, WD_AMT, 0, bob, FEE, dl, 0);

        vm.prank(relayWallet);
        vm.expectRevert("MetaTxRelayer: signer mismatch");
        relayer.relayWithdraw(_wdReq(alice, proof, root, NULL1, WD_AMT, 0, bob, FEE, dl, 0, sig));
    }

    function test_relayWithdraw_revertsReplay() public {
        uint256 root = pool.getRoot();
        bytes memory proof = dummyProof();
        uint256 dl = block.timestamp + 1 hours;
        bytes memory sig = _signWd(ALICE_PK, alice, proof, root, NULL1, WD_AMT, 0, bob, FEE, dl, 0);

        vm.prank(relayWallet);
        relayer.relayWithdraw(_wdReq(alice, proof, root, NULL1, WD_AMT, 0, bob, FEE, dl, 0, sig));

        vm.prank(relayWallet);
        vm.expectRevert("MetaTxRelayer: invalid nonce");
        relayer.relayWithdraw(_wdReq(alice, proof, root, NULL1, WD_AMT, 0, bob, FEE, dl, 0, sig));
    }

    function test_relayWithdraw_revertsModifiedRecipient() public {
        uint256 root = pool.getRoot();
        bytes memory proof = dummyProof();
        uint256 dl = block.timestamp + 1 hours;
        bytes memory sig = _signWd(ALICE_PK, alice, proof, root, NULL1, WD_AMT, 0, bob, FEE, dl, 0);

        address mallory = makeAddr("mallory");
        vm.prank(relayWallet);
        vm.expectRevert("MetaTxRelayer: signer mismatch");
        relayer.relayWithdraw(_wdReq(alice, proof, root, NULL1, WD_AMT, 0, mallory, FEE, dl, 0, sig));
    }

    function test_relayWithdraw_revertsModifiedFee() public {
        uint256 root = pool.getRoot();
        bytes memory proof = dummyProof();
        uint256 dl = block.timestamp + 1 hours;
        bytes memory sig = _signWd(ALICE_PK, alice, proof, root, NULL1, WD_AMT, 0, bob, FEE, dl, 0);

        vm.prank(relayWallet);
        vm.expectRevert("MetaTxRelayer: signer mismatch");
        relayer.relayWithdraw(_wdReq(alice, proof, root, NULL1, WD_AMT, 0, bob, 100, dl, 0, sig));
    }
}
