import crypto = require('crypto');
import stream = require('stream');
import reader = require('./reader');

var ALGORITHM = 'aes-256-cbc';

export class EncryptStream extends stream.Transform {
	private password: string;

	constructor(password) {
		super();
		this.password = password;
	}

	_transform(data: Buffer | string, enc: string, callback: Function): void {
		var chunk: Buffer;

		if (data instanceof Buffer) {
			chunk = data;
		} else {
			chunk = new Buffer(<string>data);
		}

		var clipher = crypto.createCipher(ALGORITHM, this.password);

		var encrypted = clipher.update(chunk);
		var finalEncrypted = clipher.final();

		var lenBuffer = new Buffer(4);
		lenBuffer.writeUInt32BE(encrypted.length + finalEncrypted.length, 0);

		this.push(lenBuffer);
		this.push(encrypted);
		this.push(finalEncrypted);

		callback();
	}
}

export class DecryptStream extends stream.Transform {
	private password: string;

	private packetLength: number;
	private packetBody: Buffer;

	private reader: reader.Reader = new reader.Reader([
		{
			state: 0,
			count: () => 4,
			action: (cb: reader.ConsumeCb, buffer?: Buffer) => {
				this.packetLength = buffer.readUInt32BE(0);
				cb(1);
			}
		},
		{
			state: 1,
			count: () => this.packetLength,
			action: (cb: reader.ConsumeCb, buffer?: Buffer) => {
				this.packetBody = buffer.slice(0, this.packetLength);
				cb(2);
			}
		},
		{
			state: 2,
			count: () => 0,
			action: (cb: reader.ConsumeCb, buffer?: Buffer) => {
				var decipher = crypto.createDecipher(ALGORITHM, this.password);

				try {
					var decrypted = decipher.update(this.packetBody);
					var finalDecrypted = decipher.final();

					this.push(decrypted);
					this.push(finalDecrypted);

					cb(0);
				} catch (e) {
					console.error('decrypt error:', e);

					cb(3);
				}
			}
		},
		{
			state: 3,
			count: () => 0,
			action: (cb: reader.ConsumeCb, buffer?: Buffer) => {
				this.end();
			}
		}
	]);

	constructor(password) {
		super();
		this.password = password;
	}

	_transform(data: Buffer | string, enc: string, callback: Function): void {
		var chunk: Buffer;

		if (data instanceof Buffer) {
			chunk = data;
		} else {
			chunk = new Buffer(<string>data);
		}

		this.reader.feed(chunk);

		this.reader.consumeAll();

		callback();
	}
}