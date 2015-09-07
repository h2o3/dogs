export interface ConsumeSpec {
	state: number;
	target: number;
	count: () => number;
	action: (buffer?: Buffer) => void;
}

export class Reader {
	private buffers: Array<Buffer> = [];
	private buffered: number = 0;

	state: number = 0;

	feed(buffer: Buffer) {
		this.buffers.push(buffer);
		this.buffered += buffer.length;
	}

	consume(size: number, action: (buffer?: Buffer) => void, target: number): boolean {
		if (size == 0) {
			action();
			this.state = target;
			return true;
		} else if (this.buffered >= size || size == Number.MAX_VALUE) {
			var buffer = Buffer.concat(this.buffers);
			action(buffer);
			this.state = target;

			if (size == Number.MAX_VALUE) {
				this.buffered = 0;
				this.buffers = [];

				return false;
			} else {
				this.buffered -= size;
				this.buffers = [buffer.slice(size)];

				return true;
			}
		} else {
			return false;
		}
	}

	consumeAll(specs: Array<ConsumeSpec>) {
		while (true) {
			var broken = false;
			var hasSpec = false;
			for (var index = 0; index < specs.length; index++) {
				var spec = specs[index];
				if (this.state == spec.state) {
					hasSpec = true;

					if (!this.consume(spec.count(), spec.action, spec.target)) {
						broken = true;
						break;
					}
				}
			}
			if (!hasSpec || broken) break;
		}
	}

	reset(): void {
		this.state = 0;
	}

	remain(): Buffer {
		return Buffer.concat(this.buffers);
	}
}