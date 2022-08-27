import { S3 } from "aws-sdk";
import { Readable } from "stream";
import { fileSize, retryOnFail } from "./utils";
import * as fs from 'fs';

export class Uploader {
    async uploadFile(path: string, filename: string) {
        const client = new S3({
            endpoint: process.env.S3_ENDPOINT,
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY
            }
        });

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
}