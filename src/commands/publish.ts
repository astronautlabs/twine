import { fileExists, fileSize, randomNumberOfLength, retryOnFail, s3 } from "../utils";
import * as fs from 'fs';
import path from "path";
import * as archiver from 'archiver';
import * as os from 'os';
import { CommandInfo } from "@alterior/command-line";

export async function publish(args: string[]) {
    let pkg = require(path.join(process.cwd(), 'package.json'));
    let buildDir = path.join(process.cwd(), 'build');
    let buildTypes = ['Release', 'Debug'];
    let binaryName = `${pkg.twine.moduleName}.node`;

    for (let buildType of buildTypes) {
        let variantName = `${pkg.name}@${pkg.version}.${process.platform}-${process.arch}-${buildType}.zip`;
        let buildTypeDir = path.join(buildDir, buildType);
        let binaryFile = path.join(buildTypeDir, binaryName);
        if (!await fileExists(binaryFile))
            continue;
        
        let stagedFile = path.join(os.tmpdir(), `twine-${randomNumberOfLength(7)}.zip`);
        let archive = archiver
            .create('zip', { zlib: { level: 9 }})
            .directory(buildTypeDir, false)
        ;
        archive.pipe(fs.createWriteStream(stagedFile))
        await archive.finalize();

        await uploadFile(variantName, stagedFile);
        await new Promise<void>((rs, rj) => fs.unlink(stagedFile, err => err ? rj(err) : rs()));
    }
}

publish.info = <CommandInfo>{
    description: 'Publish artifacts for the current version/platform/architecture/build-types'
};

async function uploadFile(path: string, filename: string) {
    const client = s3();

    if (process.env.S3_FOLDER) {
        path = `${process.env.S3_FOLDER}/${path}`;
    }

    let exists = true;
    try {
        await client.headObject({ 
            Bucket: process.env.S3_BUCKET,
            Key: path
        });
    } catch (e) {
        if (e.code === 'NotFound')
            exists = false;
        else
            throw e;
    }

    if (exists) {
        console.warn(`[Already Uploaded] ${path}`);
        return;
    }

    console.warn(`[Uploading] ${path} <== ${filename}`);
    let size = await fileSize(filename);
    let chunkSize = 1024*1024*1024;
    let maxChunks = Math.ceil(size / chunkSize);
    let useMultipart = size > 1000*1000*1000*5;
    if (useMultipart) {
        // Multipart upload

        let upload = await retryOnFail(async () => client.createMultipartUpload({
            ACL: 'public-read',
            Bucket: process.env.S3_BUCKET,
            Key: path
        }).promise())

        let uploadPartResults = [];

        await new Promise<void>((resolve, reject) => {
            let chunkCount = 1;

            let buffer = Buffer.alloc(chunkSize);
            fs.open(filename, 'r', (err, fd) => {
                if (err) reject(err);

                let readNextChunk = () => {
                    fs.read(fd, buffer, 0, chunkSize, null, async (err, bytesRead) => {
                        if (err) reject(err);

                        if (bytesRead === 0) {
                            // done reading file, do any necessary finalization steps
                            fs.close(fd, (err) => {
                                if (err) reject(err);
                                else resolve();
                            });
                            return;
                        }

                        let data = buffer.slice(0, Math.min(bytesRead, chunkSize));
                        let startedAt = Date.now();

                        try {
                            let result = await retryOnFail(async () => client.uploadPart({
                                Body: data,
                                Bucket: process.env.S3_BUCKET,
                                Key: filename,
                                PartNumber: chunkCount,
                                UploadId: upload.UploadId,
                            }).promise());

                            uploadPartResults.push({
                                PartNumber: chunkCount,
                                ETag: result.ETag
                            });
                        } catch (e) {
                            reject(e);
                            return;
                        }
                        chunkCount++;
                        readNextChunk();
                    });
                }

                readNextChunk();
            });
        });

        // Complete the upload
        await retryOnFail(async () => client.completeMultipartUpload({
            Bucket: process.env.S3_BUCKET,
            Key: path,
            MultipartUpload: {
                Parts: uploadPartResults
            },
            UploadId: upload.UploadId
        }).promise());

    } else {
        await retryOnFail(async () => client.putObject({
            ACL: 'public-read',
            Bucket: process.env.S3_BUCKET,
            Body: fs.createReadStream(filename),
            Key: path
        }).promise());
    }
}

