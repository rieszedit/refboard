const fs = require('fs');
const path = require('path');

const sourceDir = 'C:\\Users\\zyoja\\OneDrive\\ドキュメント\\AI_code\\exe\\cine-stickies\\src-tauri\\icons';
const targetDir = path.join(__dirname, 'src-tauri', 'icons');

console.log('Source:', sourceDir);
console.log('Target:', targetDir);

// Create target directory
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log('Created directory:', targetDir);
}

// Copy icon files
const files = ['icon.ico', 'icon.icns', '32x32.png', '128x128.png', '128x128@2x.png'];

files.forEach(file => {
    const source = path.join(sourceDir, file);
    const target = path.join(targetDir, file);

    try {
        if (fs.existsSync(source)) {
            fs.copyFileSync(source, target);
            console.log(`✓ Copied: ${file}`);
        } else {
            console.log(`✗ Not found: ${file}`);
        }
    } catch (err) {
        console.error(`Error copying ${file}:`, err.message);
    }
});

console.log('\nDone! Icons copied to:', targetDir);
