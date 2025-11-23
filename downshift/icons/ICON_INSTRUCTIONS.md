# Icon Instructions

This directory should contain PWA icons in the following sizes:

- icon-72.png (72x72px)
- icon-96.png (96x96px)
- icon-128.png (128x128px)
- icon-144.png (144x144px)
- icon-152.png (152x152px)
- icon-192.png (192x192px)
- icon-384.png (384x384px)
- icon-512.png (512x512px)

## Design Recommendations

**Color Scheme**:
- Background: Pure black (#000000)
- Icon: Amber/Gold (#D4AF37)

**Icon Design Ideas**:
- A crescent moon with a person in a stretching pose
- Simplified stick figure in a yoga/mobility pose
- Abstract geometric shape suggesting downward movement/relaxation
- Simple "DS" monogram in stylized font

## Quick Generation Methods

### Method 1: Using Online Tools
1. Use Canva, Figma, or similar design tool
2. Create a 512x512px square image
3. Export as PNG
4. Use an online PWA icon generator to create all sizes

### Method 2: Using ImageMagick
```bash
# Create all sizes from a source 512px icon
convert icon-512.png -resize 72x72 icon-72.png
convert icon-512.png -resize 96x96 icon-96.png
convert icon-512.png -resize 128x128 icon-128.png
convert icon-512.png -resize 144x144 icon-144.png
convert icon-512.png -resize 152x152 icon-152.png
convert icon-512.png -resize 192x192 icon-192.png
convert icon-512.png -resize 384x384 icon-384.png
```

### Method 3: Using PWA Asset Generator
```bash
npx pwa-asset-generator source-icon.png ./icons --icon-only --background "#000000"
```

## Temporary Placeholder

Until you create proper icons, you can use simple colored squares as placeholders. The app will function without icons, but they're required for proper PWA installation.

To create a simple placeholder:
```bash
# Using ImageMagick to create solid color squares
convert -size 512x512 xc:"#D4AF37" icon-512.png
convert -size 192x192 xc:"#D4AF37" icon-192.png
# etc...
```
