// generate-favicons.js
import fs from "fs";
import JSZip from "jszip";
import sharp from "sharp";

const inputFile = "logo.jpg"; // your logo image
const sizes = [16, 32, 180, 192, 512];
const outputDir = "./output";
const zip = new JSZip();

async function generateFavicons() {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  for (const size of sizes) {
    const outputFile = `${outputDir}/favicon-${size}x${size}.png`;
    await sharp(inputFile)
      .resize(size, size)
      .png({ quality: 100 })
      .toFile(outputFile);

    zip.file(`favicon-${size}x${size}.png`, fs.readFileSync(outputFile));
    console.log(`✅ Generated: ${outputFile}`);
  }

  // Multi-size favicon.ico
  const icoBuffer = await sharp(inputFile)
    .resize(32, 32)
    .toFormat("ico")
    .toBuffer();
  fs.writeFileSync(`${outputDir}/favicon.ico`, icoBuffer);
  zip.file("favicon.ico", icoBuffer);

  // Add site.webmanifest
  const manifest = {
    name: "Chatr",
    short_name: "Chatr",
    icons: sizes.map((size) => ({
      src: `/favicon-${size}x${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
    })),
    theme_color: "#25A4B5",
    background_color: "#ffffff",
    display: "standalone",
  };
  fs.writeFileSync(`${outputDir}/site.webmanifest`, JSON.stringify(manifest, null, 2));
  zip.file("site.webmanifest", JSON.stringify(manifest, null, 2));

  // Save zip
  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  fs.writeFileSync("favicons.zip", zipBuffer);

  console.log("\n🎉 All favicon files generated and zipped as favicons.zip!");
}

generateFavicons().catch(console.error);
