import crypto = require('crypto');
import stream = require('stream');

var ALGORITHM = 'aes-256-cbc';

export class EncryptStream extends stream.Transform {
	private password: string;

	constructor(password) {
		super();
		this.password = password;
	}

	_transform(data: Buffer|string, enc: string, callback: Function): void {
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

	private buffers: Array<Buffer> = [];
	private buffered: number = 0;

	private state: number = 0;
	private packetLength: number;
	private packetBody: Buffer;

	constructor(password) {
		super();
		this.password = password;
	}

	_transform(data: Buffer|string, enc: string, callback: Function): void {
		var chunk: Buffer;

		if (data instanceof Buffer) {
			chunk = data;
		} else {
			chunk = new Buffer(<string>data);
		}

		this.buffers.push(chunk);
		this.buffered += chunk.length;

		while (true) {
			if (this.state == 0) {
				if (!this.consumeBuffer(4, buffer =>
					this.packetLength = buffer.readUInt32BE(0)
					)) break;
				this.state = 1;
			}

			if (this.state == 1) {
				if (!this.consumeBuffer(this.packetLength, buffer =>
					this.packetBody = buffer.slice(0, this.packetLength)
					)) break;
				this.state = 2;
			}

			if (this.state == 2) {
				var decipher = crypto.createDecipher(ALGORITHM, this.password);
				var decrypted = decipher.update(this.packetBody);
				var finalDecrypted = decipher.final();

				this.push(decrypted);
				this.push(finalDecrypted);

				this.state = 0;
			}
		}
		
		callback();
	}

	protected consumeBuffer(size: number, action: (buffer: Buffer) => any): boolean {
		if (this.buffered >= size) {
			var buffer = Buffer.concat(this.buffers);

			action(buffer);

			this.buffered -= size;
			this.buffers = [buffer.slice(size)];

			return true;
		} else {
			return false;
		}
	}
}