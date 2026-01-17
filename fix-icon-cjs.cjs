const fs = require('fs');
const path = require('path');

const pngPath = "C:\\Users\\zyoja\\.gemini\\antigravity\\brain\\2ad3a924-9fa5-43ed-b533-f77af9c5a997\\uploaded_image_2_1768594744504.png";
const icoPath = path.join('src-tauri', 'icons', 'icon.ico');

try {
    const pngBuffer = fs.readFileSync(pngPath);
    const pngSize = pngBuffer.length;

    console.log(`Reading PNG from ${pngPath}, size: ${pngSize}`);

    // ICO Header (6 bytes)
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // Reserved
    header.writeUInt16LE(1, 2); // Type 1 = ICO
    header.writeUInt16LE(1, 4); // Image Count = 1

    // Directory Entry (16 bytes)
    const entry = Buffer.alloc(16);
    entry.writeUInt8(0, 0); // Width (0 means 256)
    entry.writeUInt8(0, 1); // Height (0 means 256)
    entry.writeUInt8(0, 2); // Color count
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel
    entry.writeUInt32LE(pngSize, 8); // Data size
    entry.writeUInt32LE(22, 12); // Data offset (6 + 16)

    const icoBuffer = Buffer.concat([header, entry, pngBuffer]);
    fs.writeFileSync(icoPath, icoBuffer);
    console.log(`Successfully created valid ICO at ${icoPath} (${icoBuffer.length} bytes)`);
} catch (err) {
    console.error('Failed to create ICO:', err);
    process.exit(1);
}
