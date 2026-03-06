const fs = require("fs");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const s3 = require("./src/config/s3");

async function testUpload() {
  const fileStream = fs.createReadStream("test.txt");

  const command = new PutObjectCommand({
    Bucket: "signox-media-prod",
    Key: "media/test.txt",
    Body: fileStream,
    ContentType: "text/plain",
  });

  await s3.send(command);
  console.log("Upload successful!");
}

testUpload();
