// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TwentyFourBitPixel
/// @notice 24 ERC-721 tokens, one per bit of a single RGB pixel's 24-bit color.
///
///         The rules, in full:
///           1. Every bit always has an owner and an owner-set price.
///           2. Anyone may buy any bit by paying its price. The buyer must set
///              a new price at purchase time.
///           3. On each sale, 5% of the price goes to the artist and 95% to
///              the seller.
///           4. Only a bit's owner can toggle it on or off.
///           5. Bits cannot be transferred any other way — every change of
///              ownership is a public, priced sale.
contract TwentyFourBitPixel is ERC721, ReentrancyGuard {
    uint256 public constant NUM_BITS = 24;
    uint256 public constant ARTIST_FEE_BPS = 500; // 5% of each sale
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Receives the 5% fee from every sale
    address payable public immutable artist;

    /// @notice The current 24-bit RGB pixel color; bit i of this value is bit i's state
    uint24 public pixelColor;

    /// @notice Each bit's current price in wei. Always nonzero — every bit is always for sale.
    mapping(uint256 => uint256) public prices;

    // --- Events ---

    event BitToggled(
        uint256 indexed bitId,
        bool newState,
        uint24 newColor,
        address indexed toggler,
        uint256 timestamp
    );

    event BitBought(
        uint256 indexed bitId,
        address indexed previousOwner,
        address indexed newOwner,
        uint256 price,
        uint256 newPrice,
        uint256 timestamp
    );

    event PriceSet(
        uint256 indexed bitId,
        uint256 oldPrice,
        uint256 newPrice,
        address indexed owner,
        uint256 timestamp
    );

    // --- Errors ---

    error InvalidBitId(uint256 bitId);
    error NotBitOwner(uint256 bitId);
    error CannotBuyOwnBit(uint256 bitId);
    error InsufficientPayment(uint256 required, uint256 provided);
    error PriceMustBeNonZero();
    error TransferNotAllowed();
    error ArtistAddressRequired();

    // --- Constructor ---

    /// @param initialPrice The starting price for every bit, in wei. Must be nonzero.
    /// @param artist_ The wallet that receives the 5% fee from every sale and
    ///        initially owns all 24 bits. Fixed forever at deployment.
    constructor(uint256 initialPrice, address payable artist_)
        ERC721("TwentyFourBitPixel", "24BIT")
    {
        if (initialPrice == 0) revert PriceMustBeNonZero();
        if (artist_ == address(0)) revert ArtistAddressRequired();

        artist = artist_;

        // Mint all 24 bits to the artist. Pixel starts as 0x000000 (black).
        for (uint256 i = 0; i < NUM_BITS; i++) {
            _mint(artist_, i);
            prices[i] = initialPrice;
        }
    }

    // --- Modifiers ---

    modifier validBit(uint256 bitId) {
        if (bitId >= NUM_BITS) revert InvalidBitId(bitId);
        _;
    }

    modifier onlyBitOwner(uint256 bitId) {
        if (ownerOf(bitId) != msg.sender) revert NotBitOwner(bitId);
        _;
    }

    // --- Core Functions ---

    /// @notice Toggle a bit on or off. Only the bit's owner can toggle.
    /// @param bitId The bit to toggle (0-23)
    function toggleBit(uint256 bitId)
        external
        validBit(bitId)
        onlyBitOwner(bitId)
    {
        pixelColor ^= uint24(1 << bitId);
        bool newState = (pixelColor >> bitId) & 1 == 1;

        emit BitToggled(bitId, newState, pixelColor, msg.sender, block.timestamp);
    }

    /// @notice Buy a bit at its current price. The buyer must declare a new
    ///         nonzero price. 5% of the sale goes to the artist, 95% to the
    ///         seller, and any overpayment is refunded to the buyer.
    /// @param bitId The bit to buy (0-23)
    /// @param newPrice The buyer's new price for the bit, in wei
    function buyBit(uint256 bitId, uint256 newPrice)
        external
        payable
        validBit(bitId)
        nonReentrant
    {
        if (newPrice == 0) revert PriceMustBeNonZero();

        address previousOwner = ownerOf(bitId);
        if (previousOwner == msg.sender) revert CannotBuyOwnBit(bitId);

        uint256 price = prices[bitId];
        if (msg.value < price) revert InsufficientPayment(price, msg.value);

        prices[bitId] = newPrice;
        _transfer(previousOwner, msg.sender, bitId);

        uint256 artistFee = (price * ARTIST_FEE_BPS) / BPS_DENOMINATOR;
        uint256 sellerProceeds = price - artistFee;
        uint256 refund = msg.value - price;

        if (artistFee > 0) {
            (bool feeOk, ) = artist.call{value: artistFee}("");
            require(feeOk, "Artist fee transfer failed");
        }
        if (sellerProceeds > 0) {
            (bool sellerOk, ) = payable(previousOwner).call{value: sellerProceeds}("");
            require(sellerOk, "Seller transfer failed");
        }
        if (refund > 0) {
            (bool refundOk, ) = payable(msg.sender).call{value: refund}("");
            require(refundOk, "Refund failed");
        }

        emit BitBought(bitId, previousOwner, msg.sender, price, newPrice, block.timestamp);
    }

    /// @notice Set a new price for a bit you own. Price must be nonzero —
    ///         every bit is always for sale.
    /// @param bitId The bit to reprice (0-23)
    /// @param newPrice The new price in wei
    function setPrice(uint256 bitId, uint256 newPrice)
        external
        validBit(bitId)
        onlyBitOwner(bitId)
    {
        if (newPrice == 0) revert PriceMustBeNonZero();

        uint256 oldPrice = prices[bitId];
        prices[bitId] = newPrice;

        emit PriceSet(bitId, oldPrice, newPrice, msg.sender, block.timestamp);
    }

    // --- View Functions ---

    /// @notice Get all 24 bits' info in a single call.
    /// @return owners Array of 24 owner addresses
    /// @return bitPrices Array of 24 prices in wei
    /// @return states Array of 24 on/off states
    function getAllBitInfo()
        external
        view
        returns (
            address[24] memory owners,
            uint256[24] memory bitPrices,
            bool[24] memory states
        )
    {
        for (uint256 i = 0; i < NUM_BITS; i++) {
            owners[i] = ownerOf(i);
            bitPrices[i] = prices[i];
            states[i] = (pixelColor >> i) & 1 == 1;
        }
    }

    /// @notice Get the current pixel color as a uint24.
    function getColor() external view returns (uint24) {
        return pixelColor;
    }

    // --- Transfer Restrictions ---

    /// @dev Direct transfers are blocked: the only way a bit changes hands is
    ///      through buyBit, so every ownership change is a public sale.
    function transferFrom(address, address, uint256) public pure override {
        revert TransferNotAllowed();
    }

    /// @dev Direct safe transfers are blocked for the same reason.
    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert TransferNotAllowed();
    }
}
