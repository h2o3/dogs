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

enum State {
	READ_LEN, READ_BODY, PROCESS, EXIT
}

export class DecryptStream extends stream.Transform {
	private password: string;

	private packetLength: number;
	private packetBody: Buffer;

	private reader: reader.Reader<State> = new reader.Reader(State.READ_LEN, [
		{
			state: State.READ_LEN,
			count: () => 4,
			action: (cb: reader.ConsumeCb<State>, buffer?: Buffer) => {
				this.packetLength = buffer.readUInt32BE(0);
				cb(State.READ_BODY);
			}
		},
		{
			state: State.READ_BODY,
			count: () => this.packetLength,
			action: (cb: reader.ConsumeCb<State>, buffer?: Buffer) => {
				this.packetBody = buffer.slice(0, this.packetLength);
				cb(State.PROCESS);
			}
		},
		{
			state: State.PROCESS,
			count: () => 0,
			action: (cb: reader.ConsumeCb<State>, buffer?: Buffer) => {
				var decipher = crypto.createDecipher(ALGORITHM, this.password);

				try {
					var decrypted = decipher.update(this.packetBody);
					var finalDecrypted = decipher.final();

					this.push(decrypted);
					this.push(finalDecrypted);

					cb(State.READ_LEN);
				} catch (e) {
					console.error('decrypt error:', e);

					cb(State.EXIT);
				}
			}
		},
		{
			state: State.EXIT,
			count: () => 0,
			action: (cb: reader.ConsumeCb<State>, buffer?: Buffer) => {
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