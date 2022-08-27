import * as fs from 'fs';
import * as stream from 'stream';

export async function stat(filename : string) {
    return await new Promise<fs.Stats>((rs, rj) => fs.stat(filename, (e, s) => e ? rj(e) : rs(s)));
}

export async function fileSize(filename : string) {
    let s = await stat(filename);
    return s.size;
}

export async function finishStream(stream: stream.Writable) {
    await new Promise<void>((rs, rj) => {
        stream.on('end', () => rs());
        stream.on('finish', () => rs());
        stream.on('error', e => rj(e));
    });
}

export async function fileExists(filename : string) {
    try {
        let s = await stat(filename);
        return s.isFile() || s.isDirectory();
    } catch (e) {
        return false;
    }
}

export async function listDirectory(directory: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        fs.readdir(directory, { encoding: 'utf8' }, (err, files) => {
            if (err)
                reject(err);
            resolve(files);
        });
    });
}

/**
 * Wait a specified amount of time before resolving.
 * @param time 
 */
 export function timeout(time : number = 0) : Promise<void> {
	return new Promise<void>((resolve, reject) => {
		setTimeout(() => resolve(), time);
	});
}

export interface RetryOptions {
    count? : number;
    backOff? : 'linear' | 'exponential';
    intervalMs? : number;
}

export async function retryOnFail<T> (callback : () => Promise<T>, options? : RetryOptions) : Promise<T> {
    let error;
    let attempt = 0;
    let count = options?.count ?? 3;
    let backOff = options?.backOff ?? 'exponential';
    let interval = options?.intervalMs ?? 5000;
    let enableRetries = true;

    if (!enableRetries)
        count = 1;

    while (attempt++ < count) {
        try {
            return await callback();
        }
        catch (e) {
            console.error(e);
            error = e;
        }

        if (attempt < count) {
            console.error(`Caught error on attempt ${attempt}, retrying...`);

            if (backOff === 'linear') {
                await timeout(interval);
            } else if (backOff === 'exponential') {
                await timeout(Math.pow(interval/1000, attempt) * 1000);
            } else {
                throw new Error("`backOff` needs to be 'linear' or 'exponential'");
            }
        } else {
            console.error(`Caught error on attempt ${attempt}, aborting...`);
            throw new Error(`Retry failed on final attempt (${attempt}): ${error}`);
        }
    }
}

export function randomNumberOfLength(digits = 7, base = 10) {
    if (digits > 9)
        throw new Error(`Maximum digits is 9.`);
    
    return base**(digits-1) + Math.random() * (base**digits - base**(digits-1)) | 0;
}